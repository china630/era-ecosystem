import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PaymentOrderStatus,
  PaymentRail,
  SignatoryRole,
  SignatoryStatus,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { PaymentsService } from "../payments/payments.service";
import { AmlService } from "../aml/aml.service";
import { DboAccountsService } from "./dbo-accounts.service";
import type { CustomerJwtPayload } from "./dbo-crypto.util";

const RETAIL_AUTO_SIGN_LIMIT = 500_000n;
const CORPORATE_SIGN_LIMIT_DEFAULT = 5_000_000n;

@Injectable()
export class DboPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly payments: PaymentsService,
    private readonly accounts: DboAccountsService,
    private readonly aml: AmlService,
    private readonly events: OrchestratorEventsPublisher,
  ) {}

  private dboUserId(customerId: string) {
    return `dbo:${customerId}`;
  }

  private async getOwnedOrder(orderId: string, auth: CustomerJwtPayload) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { id: orderId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!order) throw new NotFoundException("Payment order not found");
    if (order.debtorAccountId && !auth.accountIds.includes(order.debtorAccountId)) {
      throw new ForbiddenException("Payment order not in customer scope");
    }
    if (order.createdByUserId !== this.dboUserId(auth.sub)) {
      throw new ForbiddenException("Payment order not owned by customer");
    }
    return order;
  }

  listOrders(auth: CustomerJwtPayload) {
    return this.prisma.paymentOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        createdByUserId: this.dboUserId(auth.sub),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createOrder(
    auth: CustomerJwtPayload,
    input: {
      debitAccountId: string;
      beneficiaryIban: string;
      beneficiaryName: string;
      amountMinor: bigint;
      purpose?: string;
      idempotencyKey: string;
    },
  ) {
    await this.accounts.assertNotEodLocked();
    if (!auth.accountIds.includes(input.debitAccountId)) {
      throw new ForbiddenException("Debit account not in scope");
    }

    const account = await this.prisma.account.findFirst({
      where: { id: input.debitAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Debit account not found");

    const rail = PaymentRail.INTERNAL;

    const order = await this.payments.createOrder({
      debtorAccountId: input.debitAccountId,
      creditorIban: input.beneficiaryIban,
      amountMinor: input.amountMinor,
      currency: account.currency,
      rail,
      idempotencyKey: `dbo-${input.idempotencyKey}`,
      createdByUserId: this.dboUserId(auth.sub),
      narrative: input.purpose ?? input.beneficiaryName,
    });

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { creditorName: input.beneficiaryName },
    });

    if (
      auth.channel === "RETAIL" &&
      input.amountMinor <= RETAIL_AUTO_SIGN_LIMIT
    ) {
      return this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.APPROVED },
      });
    }

    return this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: PaymentOrderStatus.PENDING_APPROVAL },
    });
  }

  async getOrder(auth: CustomerJwtPayload, orderId: string) {
    return this.getOwnedOrder(orderId, auth);
  }

  async signOrder(auth: CustomerJwtPayload, orderId: string, asanTransactionId?: string) {
    await this.accounts.assertNotEodLocked();
    const order = await this.getOwnedOrder(orderId, auth);

    if (order.status === PaymentOrderStatus.APPROVED) {
      return order;
    }
    if (order.status !== PaymentOrderStatus.PENDING_APPROVAL && order.status !== PaymentOrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot sign order in status ${order.status}`);
    }

    if (auth.channel === "CORPORATE") {
      const signatory = await this.prisma.corporateSignatory.findFirst({
        where: {
          bankOrgId: this.bankOrg.bankOrgId,
          customerId: auth.sub,
          status: SignatoryStatus.ACTIVE,
          ...(auth.signatoryRole ? { role: auth.signatoryRole as SignatoryRole } : {}),
        },
      });
      if (!signatory) throw new ForbiddenException("No active signatory role");

      const limit = signatory.limitMinor ?? CORPORATE_SIGN_LIMIT_DEFAULT;
      if (order.amountMinor > limit) {
        throw new ForbiddenException("Amount exceeds signatory limit");
      }
    }

    const updated = await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: PaymentOrderStatus.APPROVED },
    });

    await this.events.publishDboPaymentSigned({
      paymentOrderId: order.id,
      customerId: auth.sub,
      asanTransactionId,
    }).catch(() => undefined);

    return updated;
  }

  async submitOrder(auth: CustomerJwtPayload, orderId: string) {
    await this.accounts.assertNotEodLocked();
    const order = await this.getOwnedOrder(orderId, auth);

    if (order.status !== PaymentOrderStatus.APPROVED) {
      throw new BadRequestException("Order must be APPROVED before submit");
    }

    const submitted = await this.payments.submitOrder(order.id);
    return submitted;
  }

  async preflightScreen(auth: CustomerJwtPayload, orderId: string) {
    const order = await this.getOwnedOrder(orderId, auth);
    const name = order.creditorName ?? order.creditorIban;
    const result = await this.aml.screen({ name, alertId: undefined });
    return { orderId, screening: result };
  }
}
