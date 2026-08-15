import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PaymentOrderStatus,
  PaymentRail,
  Prisma,
  TxnType,
  type PaymentOrder,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import { InternalRailAdapter } from "./internal-rail.adapter";
import { StubRailAdapter } from "./stub-rail.adapter";
import { AmlService } from "../aml/aml.service";

const EXTERNAL_RAILS: PaymentRail[] = [
  PaymentRail.AZIPS,
  PaymentRail.XOHKS,
  PaymentRail.AOS,
  PaymentRail.SWIFT,
];

function requiresStaffApproval(rail: PaymentRail): boolean {
  return EXTERNAL_RAILS.includes(rail);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
    private readonly internalRail: InternalRailAdapter,
    private readonly stubRail: StubRailAdapter,
    private readonly aml: AmlService,
  ) {}

  listOrders(status?: PaymentOrderStatus) {
    return this.prisma.paymentOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  getOrder(id: string) {
    return this.prisma.paymentOrder.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { railMessages: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
  }

  createOrder(input: {
    debtorAccountId?: string;
    creditorIban: string;
    amountMinor: bigint;
    currency: string;
    rail: PaymentRail;
    idempotencyKey: string;
    createdByUserId: string;
    narrative?: string;
  }) {
    return this.prisma.paymentOrder.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        debtorAccountId: input.debtorAccountId,
        creditorIban: input.creditorIban,
        amountMinor: input.amountMinor,
        currency: input.currency,
        rail: input.rail,
        status: PaymentOrderStatus.DRAFT,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: input.createdByUserId,
        narrative: input.narrative,
      },
    });
  }

  private async settleToLedger(order: {
    id: string;
    debtorAccountId: string | null;
    creditorIban: string;
    amountMinor: bigint;
    currency: string;
    rail: PaymentRail;
    createdByUserId: string;
    idempotencyKey: string;
  }) {
    if (!order.debtorAccountId) {
      throw new BadRequestException("debtorAccountId required for settlement posting");
    }
    const debtor = await this.prisma.account.findFirst({
      where: { id: order.debtorAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!debtor) throw new NotFoundException("Debtor account not found");

    const creditorAccount = await this.prisma.account.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        iban: order.creditorIban,
      },
    });

    const legs: Array<{
      accountId?: string;
      glAccountId: string;
      branchId: string;
      debitMinor: bigint;
      creditMinor: bigint;
      currency: string;
    }> = [
      {
        accountId: debtor.id,
        glAccountId: debtor.glAccountId,
        branchId: debtor.branchId,
        debitMinor: order.amountMinor,
        creditMinor: 0n,
        currency: order.currency,
      },
    ];

    if (creditorAccount && order.rail === PaymentRail.INTERNAL) {
      legs.push({
        accountId: creditorAccount.id,
        glAccountId: creditorAccount.glAccountId,
        branchId: creditorAccount.branchId,
        debitMinor: 0n,
        creditMinor: order.amountMinor,
        currency: order.currency,
      });
    } else {
      const nostro = await this.systemGl.resolve(SystemGlKey.NOSTRO);
      legs.push({
        glAccountId: nostro.id,
        branchId: debtor.branchId,
        debitMinor: 0n,
        creditMinor: order.amountMinor,
        currency: order.currency,
      });
    }

    await this.postingEngine.post({
      reference: `PAY-${order.id}`,
      idempotencyKey: `pay-settle-${order.idempotencyKey}`,
      valueDate: new Date(),
      type: TxnType.PAYMENT,
      makerUserId: order.createdByUserId,
      branchId: debtor.branchId,
      autoApprove: true,
      legs,
    });
  }

  private async executeRail(order: PaymentOrder) {
    const adapter =
      order.rail === PaymentRail.INTERNAL ? this.internalRail : this.stubRail;
    const result = await adapter.submit(order);

    await this.prisma.paymentRailMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        paymentOrderId: order.id,
        direction: "OUTBOUND",
        rail: order.rail,
        payloadJson: {
          ...result.payload,
          processorRef: result.processorRef,
        } as Prisma.InputJsonValue,
      },
    });

    if (result.accepted) {
      await this.settleToLedger(order);
    }

    const nextStatus = result.accepted
      ? PaymentOrderStatus.SETTLED
      : PaymentOrderStatus.REJECTED;

    return this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
  }

  /**
   * Maker submit:
   * - EXTERNAL rails: DRAFT → PENDING_APPROVAL (staff checker required)
   * - INTERNAL: DRAFT → rail immediately
   * - DBO path: APPROVED → rail (customer already signed)
   */
  async submitOrder(id: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!order) throw new NotFoundException("Payment order not found");

    const fraud = await this.aml.scoreFraud({
      reference: order.id,
      channel: "PAYMENT_SUBMIT",
      amountMinor: order.amountMinor,
      currency: order.currency,
    });
    if (fraud.holdPayment) {
      throw new BadRequestException({
        code: "FRAUD_HOLD",
        message: "Payment held by fraud score hook",
        score: fraud.score,
        reasonCodes: fraud.reasonCodes,
      });
    }

    if (order.status === PaymentOrderStatus.APPROVED) {
      return this.executeRail(order);
    }

    if (order.status !== PaymentOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit payment in status ${order.status}`,
      );
    }

    if (requiresStaffApproval(order.rail)) {
      return this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.PENDING_APPROVAL },
      });
    }

    return this.executeRail(order);
  }

  async approveOrder(id: string, checkerUserId: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!order) throw new NotFoundException("Payment order not found");
    if (order.status !== PaymentOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve payment in status ${order.status}`,
      );
    }
    if (order.createdByUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot approve own payment order (segregation of duties)",
      );
    }

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: PaymentOrderStatus.APPROVED },
    });

    return this.executeRail(order);
  }

  async rejectOrder(id: string, checkerUserId: string, reason?: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!order) throw new NotFoundException("Payment order not found");
    if (order.status !== PaymentOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject payment in status ${order.status}`,
      );
    }
    if (order.createdByUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot reject own payment order (segregation of duties)",
      );
    }

    await this.prisma.paymentRailMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        paymentOrderId: order.id,
        direction: "INTERNAL",
        rail: order.rail,
        payloadJson: {
          action: "REJECTED_BY_CHECKER",
          checkerUserId,
          reason: reason ?? "Rejected by checker",
        } as Prisma.InputJsonValue,
      },
    });

    return this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: PaymentOrderStatus.REJECTED },
    });
  }

  inbound(input: {
    idempotencyKey: string;
    creditorIban: string;
    amountMinor: bigint;
    currency: string;
  }) {
    return this.prisma.paymentOrder.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        creditorIban: input.creditorIban,
        amountMinor: input.amountMinor,
        currency: input.currency,
        rail: PaymentRail.INTERNAL,
        status: PaymentOrderStatus.SETTLED,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: "inbound-rail",
      },
    });
  }
}
