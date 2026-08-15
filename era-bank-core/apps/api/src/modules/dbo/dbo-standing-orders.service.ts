import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { StandingOrderStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { StandingOrdersService } from "../payments/standing-orders.service";
import { DboAccountsService } from "./dbo-accounts.service";
import type { CustomerJwtPayload } from "./dbo-crypto.util";

@Injectable()
export class DboStandingOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly standingOrders: StandingOrdersService,
    private readonly accounts: DboAccountsService,
  ) {}

  list(auth: CustomerJwtPayload) {
    return this.prisma.standingOrder.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: auth.sub,
      },
      orderBy: { nextRunAt: "asc" },
    });
  }

  async create(
    auth: CustomerJwtPayload,
    input: {
      fromAccountId: string;
      toIban: string;
      amountMinor: bigint;
      currency?: string;
      nextRunAt: Date;
      cronExpr?: string;
      idempotencyKey: string;
    },
  ) {
    await this.accounts.assertNotEodLocked();
    if (!auth.accountIds.includes(input.fromAccountId)) {
      throw new ForbiddenException("Debit account not in scope");
    }

    const order = await this.standingOrders.create({
      customerId: auth.sub,
      fromAccountId: input.fromAccountId,
      toIban: input.toIban,
      amountMinor: input.amountMinor,
      currency: input.currency,
      nextRunAt: input.nextRunAt,
      cronExpr: input.cronExpr,
      idempotencyKey: `dbo-so-${input.idempotencyKey}`,
    });

    // Corporate SO above retail auto-sign threshold stays ACTIVE but flagged via metadata narrative;
    // dual-control for corp follows payment-order signatory path on pause/resume in ops if needed.
    if (auth.channel === "CORPORATE" && input.amountMinor > 500_000n) {
      return this.prisma.standingOrder.update({
        where: { id: order.id },
        data: { status: StandingOrderStatus.PAUSED },
      });
    }

    return order;
  }

  async pause(auth: CustomerJwtPayload, id: string) {
    const existing = await this.prisma.standingOrder.findFirst({
      where: {
        id,
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: auth.sub,
      },
    });
    if (!existing) throw new NotFoundException("Standing order not found");
    await this.standingOrders.pause(id);
    return this.prisma.standingOrder.findFirst({ where: { id } });
  }
}
