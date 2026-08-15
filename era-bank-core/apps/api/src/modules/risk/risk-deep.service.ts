import { Injectable } from "@nestjs/common";
import { OpRiskEventStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import {
  computeIrrbbGapMinor,
  computeOpRiskCapitalAddonMinor,
} from "../../common/fc2-fc7.util";

@Injectable()
export class IrrbbService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list(asOfDate?: Date) {
    return this.prisma.irrbbInput.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(asOfDate
          ? {
              asOfDate: {
                gte: new Date(asOfDate.toISOString().slice(0, 10)),
                lt: new Date(new Date(asOfDate).getTime() + 86400000),
              },
            }
          : {}),
      },
      orderBy: { bucketKey: "asc" },
    });
  }

  upsert(input: {
    asOfDate: Date;
    bucketKey: string;
    amountMinor: bigint;
    rateBps: number;
  }) {
    return this.prisma.irrbbInput.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate: input.asOfDate,
        bucketKey: input.bucketKey,
        amountMinor: input.amountMinor,
        rateBps: input.rateBps,
      },
    });
  }

  async gapReport(asOfDate: Date, shockBps = 200) {
    const rows = await this.list(asOfDate);
    const calc = computeIrrbbGapMinor(
      rows.map((r) => ({
        bucketKey: r.bucketKey,
        amountMinor: r.amountMinor,
        rateBps: r.rateBps,
      })),
      shockBps,
    );
    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      shockBps,
      ...calc,
      gapMinor: calc.gapMinor.toString(),
      shockedPnlMinor: calc.shockedPnlMinor.toString(),
    };
  }
}

@Injectable()
export class OpRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list(status?: OpRiskEventStatus) {
    return this.prisma.opRiskLossEvent.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { eventDate: "desc" },
    });
  }

  create(input: {
    eventDate: Date;
    amountMinor: bigint;
    currency?: string;
    category: string;
    description: string;
  }) {
    return this.prisma.opRiskLossEvent.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        eventDate: input.eventDate,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        category: input.category,
        description: input.description,
        status: OpRiskEventStatus.OPEN,
      },
    });
  }

  close(id: string) {
    return this.prisma.opRiskLossEvent.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: OpRiskEventStatus.CLOSED },
    });
  }

  async capitalAddon(status: OpRiskEventStatus = OpRiskEventStatus.OPEN) {
    const events = await this.list(status);
    const calc = computeOpRiskCapitalAddonMinor(
      events.map((e) => ({ amountMinor: e.amountMinor, category: e.category })),
    );
    return {
      statusFilter: status,
      eventCount: events.length,
      addonMinor: calc.addonMinor.toString(),
      byCategory: calc.byCategory,
      methodology: "lab_loss_event_weighted_stub",
    };
  }
}
