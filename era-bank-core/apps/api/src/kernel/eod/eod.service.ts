import { Injectable } from "@nestjs/common";
import { EodStatus, HoldReason } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { OrchestratorEventsPublisher } from "../../integration/orchestrator-events.publisher";
import { LedgerService } from "../ledger/ledger.service";
import { DataHubClient } from "../../integration/data-hub.client";
import { TreasuryService } from "../../modules/treasury/treasury.service";
import { DepositsService } from "../../modules/deposits/deposits.service";
import { LoansService } from "../../modules/loans/loans.service";
import { RiskService } from "../../modules/risk/risk.service";
import { StandingOrdersService } from "../../modules/payments/standing-orders.service";
import { CashService } from "../../modules/cash/cash.service";
import { CollectionsService } from "../../modules/collections/collections.service";
import { TradeService } from "../../modules/trade/trade.service";
import { BranchService } from "../branch/branch.service";

@Injectable()
export class EodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly ledger: LedgerService,
    private readonly dataHub: DataHubClient,
    private readonly events: OrchestratorEventsPublisher,
    private readonly treasury: TreasuryService,
    private readonly deposits: DepositsService,
    private readonly loans: LoansService,
    private readonly risk: RiskService,
    private readonly standingOrders: StandingOrdersService,
    private readonly cash: CashService,
    private readonly collections: CollectionsService,
    private readonly trade: TradeService,
    private readonly branch: BranchService,
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
        bankOrgId_businessDate: {
          bankOrgId: this.bankOrg.bankOrgId,
          businessDate,
        },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        businessDate,
        status: EodStatus.RUNNING,
      },
      update: { status: EodStatus.RUNNING },
    });

    const fxRate = await this.dataHub.getFxRate("USD", businessDate);

    const fxRevaluation = await this.treasury.runFxRevaluation({
      asOfDate: businessDate,
      makerUserId: "eod-system",
      idempotencyKey: `eod-fx-reval-${businessDate.toISOString().slice(0, 10)}`,
    });

    const mfrReconcile = await this.branch.reconcileMfr(
      businessDate,
      "eod-system",
    );

    const working = await this.dataHub.isWorkingDay(businessDate);
    if (!working) {
      return this.prisma.eodRun.update({
        where: {
          bankOrgId_businessDate: {
            bankOrgId: this.bankOrg.bankOrgId,
            businessDate,
          },
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

    const floatingResets = {
      deposits: await this.deposits.resetFloatingRates(businessDate),
      loans: await this.loans.resetDueFloatingRates(businessDate),
    };

    const depositInterestAccrual =
      await this.deposits.accrueDailyInterest(businessDate);

    const standingOrders = await this.standingOrders.runDue(
      businessDate,
      "eod-system",
    );
    const sdbRent = await this.cash.countSdbRentDue(businessDate);
    const collectionsAging = await this.collections.agingSnapshot();
    const tradeContingentReval =
      await this.trade.contingentRevalStub(businessDate);
    const adifSnapshot = {
      stub: true,
      adifTaggedDeposits: await this.prisma.depositContract.count({
        where: {
          bankOrgId: this.bankOrg.bankOrgId,
          status: "ACTIVE",
        },
      }),
    };

    const lcr = await this.risk.lcr(businessDate);

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
        bankOrgId_businessDate: {
          bankOrgId: this.bankOrg.bankOrgId,
          businessDate,
        },
      },
      data: {
        status: balanced ? EodStatus.COMPLETED : EodStatus.FAILED,
        balancedAt: balanced ? new Date() : null,
        steps: {
          fxRevaluation: { usdRate: fxRate, ...fxRevaluation },
          treasury: {
            gapSnapshotId: gapSnapshot.id,
            lcrRatioStub:
              (gapSnapshot.bucketsJson as { lcrRatioStub?: number | null })
                ?.lcrRatioStub ?? null,
          },
          interbranchNetting: mfrReconcile,
          cardSettlement: {
            expiredAuthHolds: expiredHolds.count,
            settledTxnCount: cardSettlementCount,
          },
          floatingRateReset: floatingResets,
          depositInterestAccrual,
          standingOrders,
          sdbRent: { dueCount: sdbRent },
          collectionsAging,
          tradeContingentReval,
          adifSnapshot,
          lcr: {
            owner: "banking_risk",
            lcrRatio: lcr.lcrRatio,
            gapSnapshotId: lcr.gapSnapshotId ?? null,
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
          bankOrgId_businessDate: {
            bankOrgId: this.bankOrg.bankOrgId,
            businessDate,
          },
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

  /** EOM: ECL calc (pending provision approval) + RWA/CAR snapshots. */
  async runEom(asOfDate: Date) {
    const ecl = await this.risk.runEcl({
      asOfDate,
      runStagingFirst: true,
      methodology: "PD_LGD",
      makerUserId: "eom-system",
    });
    const capital = await this.risk.runCapital(asOfDate);
    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      eclRunId: ecl.id,
      eclStatus: ecl.status,
      rwaId: capital.rwa.id,
      carId: capital.car.id,
      carRatio: capital.car.carRatio,
      note: "EOM lab batch — ECL provision requires checker approve",
    };
  }
}
