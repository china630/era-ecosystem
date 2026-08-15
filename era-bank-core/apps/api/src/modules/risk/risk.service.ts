import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EclRunStatus,
  LoanStatus,
  OpRiskEventStatus,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import { LoansService } from "../loans/loans.service";
import { parseCollateralRef } from "../loans/loan-risk.util";
import {
  calculateEclBatch,
  type EclMatrices,
  type EclMethodology,
} from "./ecl.engine";
import { LiquidityRatioService } from "./liquidity-ratio.service";
import { CapitalService } from "./capital.service";
import { IrrbbService, OpRiskService } from "./risk-deep.service";

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly loans: LoansService,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
    private readonly liquidity: LiquidityRatioService,
    private readonly capital: CapitalService,
    private readonly irrbb: IrrbbService,
    private readonly opRisk: OpRiskService,
  ) {}

  async dashboard() {
    const exposures = await this.loans.listExposures();
    const byStage = { 1: 0, 2: 0, 3: 0 };
    let nplCount = 0;
    let outstandingTotal = 0n;
    for (const e of exposures) {
      const stage = (
        e.ifrs9Stage === 2 || e.ifrs9Stage === 3 ? e.ifrs9Stage : 1
      ) as 1 | 2 | 3;
      byStage[stage] += 1;
      if (e.isNpl) nplCount += 1;
      outstandingTotal += BigInt(e.outstandingMinor);
    }

    const lastRun = await this.prisma.eclCalculationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [
            EclRunStatus.COMPLETED,
            EclRunStatus.PENDING_PROVISION_APPROVAL,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const [lcr, car] = await Promise.all([
      this.liquidity.lcr(),
      this.capital.lastCar(),
    ]);

    return {
      loanCount: exposures.length,
      nplCount,
      outstandingTotalMinor: outstandingTotal.toString(),
      byStage,
      lcrRatio: lcr.lcrRatio,
      carRatio: car?.carRatio ?? null,
      lastEclRun: lastRun
        ? {
            id: lastRun.id,
            asOfDate: lastRun.asOfDate.toISOString().slice(0, 10),
            totalEadMinor: lastRun.totalEadMinor.toString(),
            totalEclMinor: lastRun.totalEclMinor.toString(),
            provisionDeltaMinor: lastRun.provisionDeltaMinor.toString(),
            status: lastRun.status,
            methodology: lastRun.methodology,
            completedAt: lastRun.completedAt?.toISOString() ?? null,
          }
        : null,
      note: "Risk hub — lab ECL/RWA/LCR MVP; not certified IFRS 9 / CBAR",
    };
  }

  exposures() {
    return this.loans.listExposures();
  }

  async collateral() {
    const exposures = await this.loans.listExposures();
    return exposures
      .filter((e) => e.collateral)
      .map((e) => ({
        loanId: e.id,
        customerId: e.customerId,
        collateral: e.collateral,
        outstandingMinor: e.outstandingMinor,
      }));
  }

  stagingRun() {
    return this.loans.runStaging();
  }

  lastEclRun() {
    return this.prisma.eclCalculationRun.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      include: { results: true },
    });
  }

  private async loadMatrices(): Promise<EclMatrices | undefined> {
    const set = await this.prisma.eclParameterSet.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, active: true },
      orderBy: { asOfDate: "desc" },
    });
    if (!set) return undefined;
    return set.paramsJson as unknown as EclMatrices;
  }

  /**
   * ECL batch. Default STAGE_FLAT. PD_LGD uses seeded matrices.
   * Non-zero provision delta → PENDING_PROVISION_APPROVAL (maker-checker).
   */
  async runEcl(input?: {
    asOfDate?: Date;
    runStagingFirst?: boolean;
    methodology?: EclMethodology;
    makerUserId?: string;
    autoPost?: boolean;
  }) {
    const asOfDate = input?.asOfDate ?? new Date();
    const methodology: EclMethodology =
      input?.methodology === "PD_LGD" ? "PD_LGD" : "STAGE_FLAT";
    if (input?.runStagingFirst !== false) {
      await this.loans.runStaging();
    }

    const loans = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [
            LoanStatus.DISBURSED,
            LoanStatus.ACTIVE,
            LoanStatus.OVERDUE,
            LoanStatus.APPROVED,
          ],
        },
      },
    });

    const matrices =
      methodology === "PD_LGD" ? await this.loadMatrices() : undefined;
    if (methodology === "PD_LGD" && !matrices) {
      throw new BadRequestException(
        "No active EclParameterSet — seed PD/LGD matrices first",
      );
    }

    const batch = calculateEclBatch(
      loans.map((loan) => {
        const collateral = parseCollateralRef(loan.collateralRef);
        return {
          loanId: loan.id,
          outstandingMinor: loan.outstandingMinor,
          stage: loan.ifrs9Stage,
          collateralAmountMinor: BigInt(collateral?.amountMinor ?? "0"),
          akbScore: loan.akbScore,
        };
      }),
      methodology,
      matrices,
    );

    const previous = await this.prisma.eclCalculationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: EclRunStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
    });
    const previousTotal = previous?.totalEclMinor ?? 0n;
    const provisionDelta = batch.totalEclMinor - previousTotal;
    const needsApproval = provisionDelta !== 0n && input?.autoPost !== true;

    const run = await this.prisma.eclCalculationRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate,
        status: needsApproval
          ? EclRunStatus.PENDING_PROVISION_APPROVAL
          : EclRunStatus.COMPLETED,
        totalEadMinor: batch.totalEadMinor,
        totalEclMinor: batch.totalEclMinor,
        provisionDeltaMinor: provisionDelta,
        methodology,
        makerUserId: input?.makerUserId ?? "risk-system",
        note:
          methodology === "PD_LGD"
            ? "PD×LGD lab matrices — not certified IFRS 9"
            : "Stage flat-rate ECL MVP — not certified",
        completedAt: needsApproval ? null : new Date(),
        results: {
          create: batch.results.map((r) => ({
            bankOrgId: this.bankOrg.bankOrgId,
            loanId: r.loanId,
            stage: r.stage,
            eadMinor: r.eadMinor,
            eclMinor: r.eclMinor,
            stageRate: r.stageRate,
            pd: r.pd,
            lgd: r.lgd,
            collateralMinor: r.collateralMinor,
          })),
        },
      },
      include: { results: true },
    });

    if (input?.autoPost === true && provisionDelta !== 0n) {
      return this.postProvisions(run.id, "risk-system", true);
    }

    return run;
  }

  async postProvisionsApprove(runId: string, checkerUserId: string) {
    return this.postProvisions(runId, checkerUserId, false);
  }

  private async postProvisions(
    runId: string,
    checkerUserId: string,
    skipSod: boolean,
  ) {
    const run = await this.prisma.eclCalculationRun.findFirst({
      where: { id: runId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!run) throw new NotFoundException("ECL run not found");
    if (
      run.status !== EclRunStatus.PENDING_PROVISION_APPROVAL &&
      !skipSod
    ) {
      throw new BadRequestException("ECL run is not pending provision approval");
    }
    if (
      !skipSod &&
      run.makerUserId &&
      run.makerUserId === checkerUserId
    ) {
      throw new ForbiddenException(
        "Maker cannot approve own ECL provision (segregation of duties)",
      );
    }

    let postingTxnId: string | null = run.postingTxnId;
    const provisionDelta = run.provisionDeltaMinor;
    if (provisionDelta !== 0n && !postingTxnId) {
      const expenseGl = await this.systemGl.resolve(
        SystemGlKey.LOAN_LOSS_EXPENSE,
      );
      const allowanceGl = await this.systemGl.resolve(
        SystemGlKey.LOAN_LOSS_ALLOWANCE,
      );
      const hq = await this.prisma.branch.findFirst({
        where: { bankOrgId: this.bankOrg.bankOrgId, code: "HQ" },
      });
      if (!hq) throw new NotFoundException("HQ branch not seeded");

      const absDelta = provisionDelta < 0n ? -provisionDelta : provisionDelta;
      const increase = provisionDelta > 0n;
      const txn = await this.postingEngine.post({
        reference: `ECL-PROV-${run.id}`,
        idempotencyKey: `ecl-prov-${run.id}`,
        valueDate: run.asOfDate,
        type: TxnType.FEE,
        makerUserId: run.makerUserId ?? "risk-system",
        branchId: hq.id,
        autoApprove: true,
        legs: increase
          ? [
              {
                glAccountId: expenseGl.id,
                branchId: hq.id,
                debitMinor: absDelta,
                creditMinor: 0n,
                currency: "AZN",
              },
              {
                glAccountId: allowanceGl.id,
                branchId: hq.id,
                debitMinor: 0n,
                creditMinor: absDelta,
                currency: "AZN",
              },
            ]
          : [
              {
                glAccountId: allowanceGl.id,
                branchId: hq.id,
                debitMinor: absDelta,
                creditMinor: 0n,
                currency: "AZN",
              },
              {
                glAccountId: expenseGl.id,
                branchId: hq.id,
                debitMinor: 0n,
                creditMinor: absDelta,
                currency: "AZN",
              },
            ],
      });
      postingTxnId = txn.id;
    }

    await this.prisma.auditLogEntry
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          action: "ECL_PROVISION_APPROVE",
          entity: "EclCalculationRun",
          entityId: runId,
          beforeJson: { status: run.status },
          afterJson: { status: EclRunStatus.COMPLETED, checkerUserId },
          actorUserId: checkerUserId,
        },
      })
      .catch(() => undefined);

    return this.prisma.eclCalculationRun.update({
      where: { id: run.id },
      data: {
        status: EclRunStatus.COMPLETED,
        completedAt: new Date(),
        postingTxnId,
        checkerUserId,
      },
      include: { results: true },
    });
  }

  async postProvisionsReject(runId: string, checkerUserId: string) {
    const run = await this.prisma.eclCalculationRun.findFirst({
      where: { id: runId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!run) throw new NotFoundException("ECL run not found");
    if (run.status !== EclRunStatus.PENDING_PROVISION_APPROVAL) {
      throw new BadRequestException("ECL run is not pending provision approval");
    }
    if (run.makerUserId && run.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot reject own ECL provision (segregation of duties)",
      );
    }
    return this.prisma.eclCalculationRun.update({
      where: { id: runId },
      data: {
        status: EclRunStatus.FAILED,
        checkerUserId,
        completedAt: new Date(),
        note: `${run.note ?? ""} | provision rejected by ${checkerUserId}`,
      },
    });
  }

  lcr(asOfDate?: Date) {
    return this.liquidity.lcr(asOfDate);
  }

  nsfr(asOfDate?: Date) {
    return this.liquidity.nsfr(asOfDate);
  }

  async runCapital(asOfDate?: Date) {
    const date = asOfDate ?? new Date();
    const rwa = await this.capital.computeRwa(date);
    const car = await this.capital.capitalAdequacy(date, rwa.totalRwaMinor);
    return { rwa, car };
  }

  largeExposures() {
    return this.capital.largeExposures();
  }

  lastRwa() {
    return this.capital.lastRwa();
  }

  lastCar() {
    return this.capital.lastCar();
  }

  listIrrbbInputs(asOfDate?: Date) {
    return this.irrbb.list(asOfDate);
  }

  upsertIrrbbInput(input: {
    asOfDate: Date;
    bucketKey: string;
    amountMinor: bigint;
    rateBps: number;
  }) {
    return this.irrbb.upsert(input);
  }

  listOpRiskEvents(status?: OpRiskEventStatus) {
    return this.opRisk.list(status);
  }

  createOpRiskEvent(input: {
    eventDate: Date;
    amountMinor: bigint;
    currency?: string;
    category: string;
    description: string;
  }) {
    return this.opRisk.create(input);
  }

  closeOpRiskEvent(id: string) {
    return this.opRisk.close(id);
  }

  irrbbGap(asOfDate?: Date, shockBps?: number) {
    return this.irrbb.gapReport(asOfDate ?? new Date(), shockBps);
  }

  opRiskCapitalAddon(status?: OpRiskEventStatus) {
    return this.opRisk.capitalAddon(status);
  }

  async capitalWithNsfr(asOfDate?: Date) {
    const date = asOfDate ?? new Date();
    const [car, nsfrBreakdown] = await Promise.all([
      this.lastCar(),
      this.liquidity.nsfr(date),
    ]);
    return {
      car,
      nsfrBreakdown: {
        nsfrRatio: nsfrBreakdown.nsfrRatio,
        asOfDate: nsfrBreakdown.asOfDate ?? null,
        gapSnapshotId: nsfrBreakdown.gapSnapshotId ?? null,
        source: nsfrBreakdown.source ?? null,
        note: nsfrBreakdown.note ?? null,
      },
    };
  }

  /** XO-8 methodology pack — lab scaffold only; not a certified ICAAP claim. */
  certificationPack() {
    return {
      methodology: "lab",
      certified: false,
      note: "RSK-CERT pack ready for YC-E4 partner review — not Basel/IFRS9 certified",
      checklist: [
        { id: "ICAAP-01", item: "Capital policy document draft", status: "stub" },
        { id: "ICAAP-02", item: "Risk appetite statement", status: "stub" },
        { id: "ICAAP-03", item: "Stress scenario definitions", status: "stub" },
        { id: "ICAAP-04", item: "ECL model validation report", status: "lab_only" },
        { id: "ICAAP-05", item: "RWA reconciliation workbook", status: "lab_only" },
        { id: "ICAAP-06", item: "Liquidity contingency plan", status: "stub" },
        { id: "ICAAP-07", item: "Board risk committee minutes template", status: "stub" },
      ],
      inventoryCap: "CAP-RSK-CERT",
      ycWave: "YC-E4",
    };
  }
}
