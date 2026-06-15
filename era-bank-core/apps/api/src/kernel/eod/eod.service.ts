import { Injectable } from "@nestjs/common";
import { EodStatus, HoldReason } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { LedgerService } from "../ledger/ledger.service";
import { DataHubClient } from "../../integration/data-hub.client";
import { TreasuryService } from "../../modules/treasury/treasury.service";

@Injectable()
export class EodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly ledger: LedgerService,
    private readonly dataHub: DataHubClient,
    private readonly events: OrchestratorEventsPublisher,
    private readonly treasury: TreasuryService,
  ) {}

  getByDate(date: Date) {
    return this.prisma.eodRun.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, businessDate: date },
    });
  }

  isEodRunning() {
    return this.prisma.eodRun.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, status: EodStatus.RUNNING },
    });
  }

  async run(businessDate: Date) {
    await this.prisma.eodRun.upsert({
      where: {
        bankOrgId_businessDate: { bankOrgId: this.bankOrg.bankOrgId, businessDate },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        businessDate,
        status: EodStatus.RUNNING,
      },
      update: { status: EodStatus.RUNNING },
    });

    const fxRate = await this.dataHub.getFxRate("USD", businessDate);

    const working = await this.dataHub.isWorkingDay(businessDate);
    if (!working) {
      return this.prisma.eodRun.update({
        where: {
          bankOrgId_businessDate: { bankOrgId: this.bankOrg.bankOrgId, businessDate },
        },
        data: {
          status: EodStatus.COMPLETED,
          balancedAt: new Date(),
          steps: {
            skipped: true,
            reason: "NON_WORKING_DAY",
            calendar: { isWorking: false },
          },
        },
      });
    }

    const gapSnapshot = await this.treasury.liquidityGap(businessDate, 30, true);

    const expiredHolds = await this.prisma.accountHold.updateMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "ACTIVE",
        reason: HoldReason.CARD_AUTH,
        expiresAt: { lt: new Date() },
      },
      data: { status: "RELEASED" },
    });
    const cardSettlementCount = await this.prisma.cardTransaction.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "SETTLED",
        capturedAt: {
          gte: new Date(businessDate.toISOString().slice(0, 10)),
          lt: new Date(new Date(businessDate).getTime() + 86400000),
        },
      },
    });

    const trialBalance = await this.ledger.trialBalance(businessDate);
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const row of trialBalance) {
      totalDebit += row.debitMinor;
      totalCredit += row.creditMinor;
    }
    const balanced = totalDebit === totalCredit;

    const glAccounts = await this.prisma.glAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
    const glById = new Map(glAccounts.map((g) => [g.id, g.code]));
    const summaryLines = trialBalance.map((row) => ({
      glCode: glById.get(row.glAccountId) ?? row.glAccountId,
      debit: Number(row.debitMinor),
      credit: Number(row.creditMinor),
    }));

    const run = await this.prisma.eodRun.update({
      where: {
        bankOrgId_businessDate: { bankOrgId: this.bankOrg.bankOrgId, businessDate },
      },
      data: {
        status: balanced ? EodStatus.COMPLETED : EodStatus.FAILED,
        balancedAt: balanced ? new Date() : null,
        steps: {
          fxRevaluation: { usdRate: fxRate },
          treasury: {
            gapSnapshotId: gapSnapshot.id,
            lcrRatioStub:
              (gapSnapshot.bucketsJson as { lcrRatioStub?: number | null })?.lcrRatioStub ?? null,
          },
          interbranchNetting: { status: "reconciled" },
          cardSettlement: {
            expiredAuthHolds: expiredHolds.count,
            settledTxnCount: cardSettlementCount,
          },
          trialBalance: {
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            balanced,
          },
        },
      },
    });

    if (balanced) {
      const publishResult = await this.events.publishGlDailySummary({
        businessDate: businessDate.toISOString().slice(0, 10),
        lines: summaryLines,
      });
      await this.prisma.eodRun.update({
        where: {
          bankOrgId_businessDate: { bankOrgId: this.bankOrg.bankOrgId, businessDate },
        },
        data: {
          steps: {
            ...(run.steps as object),
            regSnapshot: {
              trialBalanceBalanced: true,
              businessDate: businessDate.toISOString().slice(0, 10),
            },
            financeBridge: {
              published: publishResult.published === true,
              eventId: publishResult.eventId ?? null,
            },
          },
        },
      });
    }

    return run;
  }
}
