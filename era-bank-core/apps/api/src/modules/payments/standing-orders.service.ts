import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  StandingOrderStatus,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { assertIdempotencyKey } from "../../common/idempotency";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import { buildStandingOrderRunLegs } from "./standing-order-posting.util";

@Injectable()
export class StandingOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  list(status?: StandingOrderStatus) {
    return this.prisma.standingOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { nextRunAt: "asc" },
    });
  }

  create(input: {
    customerId: string;
    fromAccountId: string;
    toIban: string;
    amountMinor: bigint;
    currency?: string;
    cronExpr?: string;
    nextRunAt: Date;
    idempotencyKey: string;
  }) {
    return this.prisma.standingOrder.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        fromAccountId: input.fromAccountId,
        toIban: input.toIban,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        cronExpr: input.cronExpr ?? "0 9 * * 1",
        nextRunAt: input.nextRunAt,
        idempotencyKey: assertIdempotencyKey(input.idempotencyKey),
        status: StandingOrderStatus.ACTIVE,
      },
    });
  }

  async runDue(asOf: Date, makerUserId = "eod-system") {
    const due = await this.prisma.standingOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: StandingOrderStatus.ACTIVE,
        nextRunAt: { lte: asOf },
      },
    });

    const results: Array<{ id: string; journalTxnId: string }> = [];
    for (const order of due) {
      const account = await this.prisma.account.findFirst({
        where: {
          id: order.fromAccountId,
          bankOrgId: this.bankOrg.bankOrgId,
        },
      });
      if (!account) continue;

      const clearing = await this.systemGl.resolve(
        SystemGlKey.STANDING_ORDER_CLEARING,
      );
      const legs = buildStandingOrderRunLegs({
        amountMinor: order.amountMinor,
        currency: order.currency,
        branchId: account.branchId,
        fromAccountId: account.id,
        fromGlAccountId: account.glAccountId,
        clearingGlId: clearing.id,
      });

      const txn = await this.postingEngine.post({
        reference: `SO-RUN-${order.id}`,
        idempotencyKey: `so-run-${order.id}-${asOf.toISOString().slice(0, 10)}`,
        valueDate: asOf,
        type: TxnType.PAYMENT,
        makerUserId,
        branchId: account.branchId,
        autoApprove: true,
        allowDuringEod: true,
        legs,
      });

      const nextRunAt = new Date(order.nextRunAt);
      nextRunAt.setDate(nextRunAt.getDate() + 7);

      await this.prisma.standingOrder.update({
        where: { id: order.id },
        data: {
          lastRunAt: asOf,
          nextRunAt,
        },
      });
      results.push({ id: order.id, journalTxnId: txn.id });
    }
    return { processed: results.length, results };
  }

  pause(id: string) {
    return this.prisma.standingOrder.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: StandingOrderStatus.PAUSED },
    });
  }

  cancel(id: string) {
    return this.prisma.standingOrder.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: StandingOrderStatus.CANCELLED },
    });
  }
}
