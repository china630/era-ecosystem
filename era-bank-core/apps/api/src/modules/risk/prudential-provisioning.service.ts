import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LoanStatus,
  PrudentialCategory,
  PrudentialRunStatus,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode } from "../../common/product-gl";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import { computeDaysPastDue } from "../loans/loan-risk.util";
import {
  classifyPrudentialBatch,
  type PrudentialRateRow,
} from "./prudential-classification.engine";
import {
  buildUmidsizWriteOffLegs,
  assertUmidsizWriteOffSoD,
  isUmidsizCategory,
} from "./umidsiz-write-off.util";

@Injectable()
export class PrudentialProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  async loadActiveRateTable(): Promise<PrudentialRateRow[]> {
    const rows = await this.prisma.prudentialRateTable.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, active: true },
      orderBy: { dpdMin: "asc" },
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        "PrudentialRateTable not seeded — run db:seed",
      );
    }
    return rows.map((r) => ({
      category: r.category,
      dpdMin: r.dpdMin,
      dpdMax: r.dpdMax,
      provisionRate: r.provisionRate,
      rateLabel: r.rateLabel,
    }));
  }

  private async loanDpd(
    loanId: string,
    asOf: Date,
  ): Promise<{ dpd: number; qualityFlags: string[] }> {
    const installments = await this.prisma.loanScheduleInstallment.findMany({
      where: { loanId, bankOrgId: this.bankOrg.bankOrgId },
      select: { dueDate: true, status: true },
    });
    const dpd = computeDaysPastDue(
      installments.map((i) => ({ dueDate: i.dueDate, status: i.status })),
      asOf,
    );
    const loan = await this.prisma.loanContract.findFirst({
      where: { id: loanId, bankOrgId: this.bankOrg.bankOrgId },
      select: { qualityFlagsJson: true },
    });
    const raw = loan?.qualityFlagsJson;
    const qualityFlags = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
    return { dpd, qualityFlags };
  }

  /**
   * CBAR prudential classification batch (EOM step, parallel to ECL).
   * Non-zero provision delta → PENDING_PROVISION_APPROVAL unless autoPost.
   */
  async runClassification(input?: {
    asOfDate?: Date;
    makerUserId?: string;
    autoPost?: boolean;
    qualityOverrides?: Record<string, string[]>;
  }) {
    const asOfDate = input?.asOfDate ?? new Date();
    const rateRows = await this.loadActiveRateTable();

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

    const loanInputs = await Promise.all(
      loans.map(async (loan) => {
        const { dpd, qualityFlags } = await this.loanDpd(loan.id, asOfDate);
        const override = input?.qualityOverrides?.[loan.id];
        return {
          loanId: loan.id,
          outstandingMinor: loan.outstandingMinor,
          dpd,
          qualityFlags: override ?? qualityFlags,
        };
      }),
    );

    const batch = classifyPrudentialBatch(loanInputs, rateRows);

    const previous = await this.prisma.prudentialClassificationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: PrudentialRunStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
    });
    const previousTotal = previous?.totalProvisionMinor ?? 0n;
    const provisionDelta = batch.totalProvisionMinor - previousTotal;
    const needsApproval = provisionDelta !== 0n && input?.autoPost !== true;

    const run = await this.prisma.prudentialClassificationRun.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate,
        status: needsApproval
          ? PrudentialRunStatus.PENDING_PROVISION_APPROVAL
          : PrudentialRunStatus.COMPLETED,
        totalOutstandingMinor: batch.totalOutstandingMinor,
        totalProvisionMinor: batch.totalProvisionMinor,
        provisionDeltaMinor: provisionDelta,
        makerUserId: input?.makerUserId ?? "risk-system",
        note: "CBAR prudential classification MVP — parallel to IFRS 9 ECL",
        completedAt: needsApproval ? null : new Date(),
        results: {
          create: batch.results.map((r) => ({
            bankOrgId: this.bankOrg.bankOrgId,
            loanId: r.loanId,
            category: r.category,
            dpd: r.dpd,
            qualityFlags: r.qualityFlags,
            rate: r.rate,
            provisionMinor: r.provisionMinor,
          })),
        },
      },
      include: { results: true },
    });

    if (input?.autoPost === true && provisionDelta !== 0n) {
      return this.postProvisions(run.id, input.makerUserId ?? "risk-system", true);
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
    const run = await this.prisma.prudentialClassificationRun.findFirst({
      where: { id: runId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!run) throw new NotFoundException("Prudential run not found");
    if (
      run.status !== PrudentialRunStatus.PENDING_PROVISION_APPROVAL &&
      !skipSod
    ) {
      throw new BadRequestException(
        "Prudential run is not pending provision approval",
      );
    }
    if (!skipSod && run.makerUserId && run.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot approve own prudential provision (segregation of duties)",
      );
    }

    let postingTxnId: string | null = run.postingTxnId;
    const provisionDelta = run.provisionDeltaMinor;
    if (provisionDelta !== 0n && !postingTxnId) {
      const expenseGl = await this.systemGl.resolve(
        SystemGlKey.PRUDENTIAL_EXPENSE,
      );
      const allowanceGl = await this.systemGl.resolve(
        SystemGlKey.PRUDENTIAL_ALLOWANCE,
      );
      const hq = await this.prisma.branch.findFirst({
        where: { bankOrgId: this.bankOrg.bankOrgId, code: "HQ" },
      });
      if (!hq) throw new NotFoundException("HQ branch not seeded");

      const absDelta = provisionDelta < 0n ? -provisionDelta : provisionDelta;
      const increase = provisionDelta > 0n;
      const txn = await this.postingEngine.post({
        reference: `CBAR-PROV-${run.id}`,
        idempotencyKey: `prudential-prov-${run.id}`,
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
          action: "PRUDENTIAL_PROVISION_APPROVE",
          entity: "PrudentialClassificationRun",
          entityId: runId,
          beforeJson: { status: run.status },
          afterJson: {
            status: PrudentialRunStatus.COMPLETED,
            checkerUserId,
          },
          actorUserId: checkerUserId,
        },
      })
      .catch(() => undefined);

    return this.prisma.prudentialClassificationRun.update({
      where: { id: run.id },
      data: {
        status: PrudentialRunStatus.COMPLETED,
        completedAt: new Date(),
        postingTxnId,
        checkerUserId,
      },
      include: { results: true },
    });
  }

  lastRun() {
    return this.prisma.prudentialClassificationRun.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      include: { results: true },
    });
  }

  /**
   * CBAR ümidsiz write-off against prudential allowance (maker ≠ checker).
   * Requires a COMPLETED classification result with category UMIDSIZ.
   */
  async writeOffUmidsizLoan(input: {
    loanId: string;
    checkerUserId: string;
    makerUserId?: string;
  }) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id: input.loanId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (loan.status === LoanStatus.WRITTEN_OFF) {
      return loan;
    }
    if (loan.outstandingMinor <= 0n) {
      throw new BadRequestException("Loan has no outstanding to write off");
    }

    const completed = await this.prisma.prudentialClassificationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: PrudentialRunStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
      include: {
        results: {
          where: { loanId: input.loanId },
        },
      },
    });
    const result = completed?.results[0];
    if (!result || !isUmidsizCategory(result.category)) {
      throw new BadRequestException(
        "Loan is not UMIDSIZ on the latest completed prudential run",
      );
    }

    const makerUserId =
      input.makerUserId?.trim() || completed?.makerUserId?.trim() || "";
    const checkerUserId = input.checkerUserId?.trim() || "";
    try {
      assertUmidsizWriteOffSoD(makerUserId, checkerUserId);
    } catch (e) {
      throw new ForbiddenException(
        e instanceof Error
          ? e.message
          : "Maker cannot approve own ümidsiz write-off (segregation of duties)",
      );
    }

    const template = await this.prisma.productTemplate.findFirst({
      where: {
        id: loan.productTemplateId,
        bankOrgId: this.bankOrg.bankOrgId,
      },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const loanGlCode = getProductGlCode(template.paramsJson, "glAssetCode");
    const loanGl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code: loanGlCode },
    });
    if (!loanGl) throw new NotFoundException(`GL ${loanGlCode} not seeded`);

    const allowanceGl = await this.systemGl.resolve(
      SystemGlKey.PRUDENTIAL_ALLOWANCE,
    );
    const hq = await this.prisma.branch.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code: "HQ" },
    });
    if (!hq) throw new NotFoundException("HQ branch not seeded");

    const amountMinor = loan.outstandingMinor;
    const legs = buildUmidsizWriteOffLegs({
      allowanceGlId: allowanceGl.id,
      loanGlId: loanGl.id,
      branchId: hq.id,
      amountMinor,
      currency: loan.currency,
    });

    await this.postingEngine.post({
      reference: `CBAR-WO-UMIDSIZ-${loan.id}`,
      idempotencyKey: `prudential-umidsiz-wo-${loan.id}`,
      valueDate: new Date(),
      type: TxnType.FEE,
      makerUserId,
      branchId: hq.id,
      // FEE is not a controlled type; SoD is enforced above (human maker ≠ checker).
      autoApprove: false,
      legs,
      sideEffectsInTx: async (tx) => {
        await tx.loanContract.update({
          where: { id: loan.id },
          data: {
            status: LoanStatus.WRITTEN_OFF,
            outstandingMinor: 0n,
            accruedInterestMinor: 0n,
            accruedPenaltyMinor: 0n,
          },
        });
        await tx.loanScheduleInstallment.updateMany({
          where: {
            loanId: loan.id,
            bankOrgId: this.bankOrg.bankOrgId,
            status: { not: "PAID" },
          },
          data: { status: "WAIVED" },
        });
      },
    });

    await this.prisma.auditLogEntry
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          action: "PRUDENTIAL_UMIDSIZ_WRITE_OFF",
          entity: "LoanContract",
          entityId: loan.id,
          beforeJson: {
            status: loan.status,
            outstandingMinor: loan.outstandingMinor.toString(),
            category: PrudentialCategory.UMIDSIZ,
          },
          afterJson: {
            status: LoanStatus.WRITTEN_OFF,
            amountMinor: amountMinor.toString(),
            makerUserId,
            checkerUserId: input.checkerUserId,
          },
          actorUserId: input.checkerUserId,
        },
      })
      .catch(() => undefined);

    return this.prisma.loanContract.findFirstOrThrow({
      where: { id: loan.id, bankOrgId: this.bankOrg.bankOrgId },
    });
  }
}