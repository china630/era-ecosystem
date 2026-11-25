import { createHash } from "crypto";
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  InstallmentStatus,
  LoanLiabilityType,
  LoanRepaymentFrequency,
  LoanStatus,
  ProductKind,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode } from "../../common/product-gl";
import {
  monthlyRateFactor,
  normalizeDayCountConvention,
} from "../../common/interest-daycount.util";
import { DataHubClient } from "../../integration/data-hub.client";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { ProductFactoryService } from "../../kernel/product-factory/product-factory.service";
import { RateIndexService } from "../../kernel/rates/rate-index.service";
import { bumpToWeekday } from "./loan-date.util";
import {
  addMonthsUtc,
  parseProductParams,
  resolveRateAndTerm,
  type LoanProductParams,
} from "../../kernel/product-factory/product-params";
import { createCreditBureauAdapter } from "./bureau.adapter";
import { CreditRegistryService } from "./credit-registry.service";
import { computeAprPercent } from "./apr.util";
import {
  businessDateKey,
  dailyLoanInterestMinor,
  dailyPenaltyMinor,
  overdueInstallmentBaseMinor,
} from "./loan-interest.util";
import { buildLoanSchedule, type ScheduleRow } from "./loan-schedule.util";
import {
  allocateRepayment,
  repayWaterfallFromParams,
} from "./loan-repay.util";
import {
  computeDaysPastDue,
  parseCollateralRef,
  serializeCollateral,
  suggestIfrs9StageFromDpd,
  type CollateralPayload,
} from "./loan-risk.util";

@Injectable()
export class LoansService {
  private readonly bureau = createCreditBureauAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly products: ProductFactoryService,
    private readonly rates: RateIndexService,
    private readonly creditRegistry: CreditRegistryService,
    private readonly dataHub: DataHubClient,
  ) {}

  /** Bump due dates to the next working day (DataHub calendar; weekend fallback). */
  private async bumpScheduleWorkingDays(
    rows: ScheduleRow[],
  ): Promise<ScheduleRow[]> {
    const out: ScheduleRow[] = [];
    for (const row of rows) {
      let d = bumpToWeekday(new Date(row.dueDate.getTime()));
      for (let i = 0; i < 14; i += 1) {
        if (await this.dataHub.isWorkingDay(d)) break;
        d = bumpToWeekday(new Date(d.getTime() + 86_400_000));
      }
      out.push({ ...row, dueDate: d });
    }
    return out;
  }

  private trackDebtStatusChange(
    loanId: string,
    customerId: string,
    previousStatus: LoanStatus | string | null,
    newStatus: LoanStatus | string,
  ) {
    void this.creditRegistry
      .enqueueDebtStatusChange({
        loanId,
        customerId,
        previousStatus: previousStatus ? String(previousStatus) : null,
        newStatus: String(newStatus),
      })
      .catch(() => undefined);
  }

  async list() {
    const loans = await this.prisma.loanContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      loans.map(async (loan) => {
        const risk = await this.enrichRisk(loan.id, loan.ifrs9Stage);
        return { ...loan, ...risk };
      }),
    );
  }

  async getById(id: string) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) return null;
    const risk = await this.enrichRisk(loan.id, loan.ifrs9Stage);
    const links = await this.prisma.loanCollateralLink.findMany({
      where: { loanId: id, bankOrgId: this.bankOrg.bankOrgId },
      include: { collateralItem: true },
      orderBy: { createdAt: "asc" },
    });
    const staleCutoff = Date.now() - 365 * 86_400_000;
    const collateralLinks = links.map((link) => ({
      id: link.id,
      sharePct: link.sharePct.toString(),
      collateralItemId: link.collateralItemId,
      type: link.collateralItem.type,
      description: link.collateralItem.description,
      valuationMinor: link.collateralItem.valuationMinor.toString(),
      haircutPct: link.collateralItem.haircutPct.toString(),
      currency: link.collateralItem.currency,
      staleRevaluation: link.collateralItem.updatedAt.getTime() < staleCutoff,
      valuationAsOf: link.collateralItem.updatedAt.toISOString(),
    }));
    return {
      ...loan,
      collateral: parseCollateralRef(loan.collateralRef),
      collateralLinks,
      ...risk,
    };
  }

  private async enrichRisk(loanId: string, currentStage: number) {
    const installments = await this.prisma.loanScheduleInstallment.findMany({
      where: { loanId, bankOrgId: this.bankOrg.bankOrgId },
      select: { dueDate: true, status: true },
    });
    const daysPastDue = computeDaysPastDue(
      installments.map((i) => ({ dueDate: i.dueDate, status: i.status })),
    );
    const suggestedStage = suggestIfrs9StageFromDpd(daysPastDue);
    const lastCompleted = await this.prisma.prudentialClassificationRun.findFirst({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });
    const prudential = lastCompleted
      ? await this.prisma.prudentialClassificationResult.findFirst({
          where: {
            runId: lastCompleted.id,
            loanId,
            bankOrgId: this.bankOrg.bankOrgId,
          },
          select: { category: true, provisionMinor: true, dpd: true },
        })
      : null;
    return {
      daysPastDue,
      suggestedIfrs9Stage: suggestedStage,
      isNpl: daysPastDue >= 90 || currentStage >= 3,
      cbarPrudentialCategory: prudential?.category ?? null,
      cbarProvisionMinor: prudential?.provisionMinor?.toString() ?? null,
      cbarPrudentialDpd: prudential?.dpd ?? null,
    };
  }

  /** EOD: SCHEDULED → DUE on value date; past due unpaid → OVERDUE. */
  async advanceInstallmentStatuses(businessDate: Date) {
    const dayStart = new Date(
      Date.UTC(
        businessDate.getUTCFullYear(),
        businessDate.getUTCMonth(),
        businessDate.getUTCDate(),
      ),
    );
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const due = await this.prisma.loanScheduleInstallment.updateMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "SCHEDULED",
        dueDate: { gte: dayStart, lt: dayEnd },
      },
      data: { status: "DUE" },
    });
    const overdue = await this.prisma.loanScheduleInstallment.updateMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: ["SCHEDULED", "DUE"] },
        dueDate: { lt: dayStart },
      },
      data: { status: "OVERDUE" },
    });
    return { markedDue: due.count, markedOverdue: overdue.count };
  }

  private async glByCode(code: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!gl) throw new NotFoundException(`GL ${code} not seeded`);
    return gl;
  }

  private async productGlCodes(productTemplateId: string) {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const assetCode = getProductGlCode(template.paramsJson, "glAssetCode");
    const interestIncomeCode = getProductGlCode(
      template.paramsJson,
      "glInterestIncomeCode",
    );
    return {
      loanGl: await this.glByCode(assetCode),
      interestGl: await this.glByCode(interestIncomeCode),
    };
  }

  async pullBureau(customerId: string) {
    return this.bureau.pullScore({
      customerId,
      bankOrgId: this.bankOrg.bankOrgId,
    });
  }

  async originate(input: {
    customerId: string;
    productTemplateId: string;
    principalMinor: bigint;
    currency?: string;
    termMonths?: number;
    rateAnnual?: number;
    collateral?: CollateralPayload;
    assetRef?: string;
    invoiceRef?: string;
    tradeRef?: string;
    projectRef?: string;
    participationPct?: number;
    leadBankName?: string;
    groupId?: string;
    liabilityType?: LoanLiabilityType;
    makerUserId?: string;
    pricingException?: boolean;
    exceptionReason?: string;
  }) {
    const template = await this.products.assertActiveLoanProduct(
      input.productTemplateId,
    );
    const params = parseProductParams(
      template.kind,
      template.paramsJson,
    ) as LoanProductParams;

    if (template.kind === ProductKind.LOAN_MORTGAGE && !input.collateral) {
      throw new BadRequestException(
        "LOAN_MORTGAGE origination requires collateral payload",
      );
    }
    if (template.kind === ProductKind.LOAN_LEASE && !input.assetRef?.trim()) {
      throw new BadRequestException("LOAN_LEASE origination requires assetRef");
    }
    if (template.kind === ProductKind.LOAN_FACTORING && !input.invoiceRef?.trim()) {
      throw new BadRequestException(
        "LOAN_FACTORING origination requires invoiceRef",
      );
    }
    if (template.kind === ProductKind.LOAN_PROJECT && !input.projectRef?.trim()) {
      throw new BadRequestException(
        "LOAN_PROJECT origination requires projectRef",
      );
    }
    if (template.kind === ProductKind.LOAN_TRADE && !input.tradeRef?.trim()) {
      throw new BadRequestException("LOAN_TRADE origination requires tradeRef");
    }
    const resolved = resolveRateAndTerm({
      templateTermMonths: params.termMonths,
      templateRateAnnual: params.rateAnnual,
      bands: {
        termMonthsMin: params.termMonthsMin,
        termMonthsMax: params.termMonthsMax,
        rateAnnualMin: params.rateAnnualMin,
        rateAnnualMax: params.rateAnnualMax,
      },
      requestedTermMonths: input.termMonths,
      requestedRateAnnual: input.rateAnnual,
      allowException: input.pricingException === true,
      exceptionReason: input.exceptionReason,
    });
    const termMonths = resolved.termMonths;
    const rateType = params.rateType === "FLOATING" ? "FLOATING" : "FIXED";
    let rateAnnual = resolved.rateAnnual;
    if (rateType === "FLOATING" && params.indexKey) {
      rateAnnual = await this.rates.resolveEffectiveRate({
        indexKey: params.indexKey,
        spreadBps: params.spreadBps,
        rateFloor: params.rateFloor,
      });
    }
    const dayCountConvention = normalizeDayCountConvention(
      params.dayCountConvention,
    );
    const currency = template.currency;
    const scheduleKind =
      template.kind === ProductKind.LOAN_DIFF ? "LOAN_DIFF" : "LOAN_ANNUITY";
    const nextResetDate =
      rateType === "FLOATING" && params.resetFrequencyMonths
        ? addMonthsUtc(new Date(), params.resetFrequencyMonths)
        : null;

    const bureau = await this.bureau.pullScore({
      customerId: input.customerId,
      bankOrgId: this.bankOrg.bankOrgId,
    });
    const gracePrincipalMonths = params.gracePrincipalMonths ?? 0;
    const graceInterestMonths = params.graceInterestMonths ?? 0;
    const repaymentFrequency =
      params.repaymentFrequency ?? LoanRepaymentFrequency.MONTHLY;
    const scheduleStart = new Date();
    const rawSchedule = buildLoanSchedule({
      kind: scheduleKind,
      principalMinor: input.principalMinor,
      termMonths,
      rateAnnual,
      dayCountConvention,
      gracePrincipalMonths,
      graceInterestMonths,
      repaymentFrequency:
        repaymentFrequency as import("./loan-schedule.util").LoanRepaymentFrequency,
    });
    const schedule = await this.bumpScheduleWorkingDays(rawSchedule);
    const aprFlows = [
      { date: scheduleStart, amountMinor: -Number(input.principalMinor) },
      ...schedule.map((row) => ({
        date: row.dueDate,
        amountMinor: Number(row.principalMinor + row.interestMinor),
      })),
    ];
    const aprPercent = computeAprPercent(aprFlows);

    const status = resolved.pricingException
      ? LoanStatus.PENDING_PRICING_APPROVAL
      : LoanStatus.APPROVED;

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loanContract.create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          customerId: input.customerId,
          productTemplateId: input.productTemplateId,
          principalMinor: input.principalMinor,
          outstandingMinor: input.principalMinor,
          rateAnnual,
          dayCountConvention,
          rateType,
          indexKey: params.indexKey ?? null,
          spreadBps: params.spreadBps ?? null,
          nextResetDate,
          termMonths,
          currency,
          status,
          akbScore: bureau.score,
          collateralRef: input.collateral
            ? serializeCollateral(input.collateral)
            : null,
          assetRef: input.assetRef ?? null,
          groupId: input.groupId ?? null,
          liabilityType: input.liabilityType ?? null,
          invoiceRef: input.invoiceRef ?? null,
          tradeRef: input.tradeRef ?? null,
          projectRef: input.projectRef ?? null,
          participationPct: input.participationPct ?? null,
          leadBankName: input.leadBankName ?? null,
          gracePrincipalMonths,
          graceInterestMonths,
          repaymentFrequency,
          firstDueDate: schedule[0]?.dueDate ?? null,
          aprPercent: aprPercent ?? undefined,
          penaltyRateAnnual: params.penaltyRateAnnual ?? null,
          makerUserId: input.makerUserId ?? "service",
          pricingExceptionReason: resolved.pricingException
            ? input.exceptionReason ?? null
            : null,
        },
      });
      for (const row of schedule) {
        await tx.loanScheduleInstallment.create({
          data: {
            bankOrgId: this.bankOrg.bankOrgId,
            loanId: loan.id,
            sequenceNo: row.sequenceNo,
            dueDate: row.dueDate,
            principalMinor: row.principalMinor,
            interestMinor: row.interestMinor,
            status: InstallmentStatus.SCHEDULED,
          },
        });
      }
      return {
        ...loan,
        termMonths,
        rateAnnual,
        bureauReportId: bureau.reportId,
      };
    });
  }

  listPendingPricing() {
    return this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: LoanStatus.PENDING_PRICING_APPROVAL,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async pricingApprove(id: string, checkerUserId: string) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (loan.status !== LoanStatus.PENDING_PRICING_APPROVAL) {
      throw new BadRequestException("Loan is not pending pricing approval");
    }
    if (loan.makerUserId && loan.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot approve own pricing exception (segregation of duties)",
      );
    }
    await this.prisma.auditLogEntry
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          action: "LOAN_PRICING_APPROVE",
          entity: "LoanContract",
          entityId: id,
          beforeJson: { status: loan.status },
          afterJson: { status: LoanStatus.APPROVED, checkerUserId },
          actorUserId: checkerUserId,
        },
      })
      .catch(() => undefined);
    const updated = await this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.APPROVED },
    });
    this.trackDebtStatusChange(
      id,
      loan.customerId,
      loan.status,
      LoanStatus.APPROVED,
    );
    return updated;
  }

  async pricingReject(id: string, checkerUserId: string) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (loan.status !== LoanStatus.PENDING_PRICING_APPROVAL) {
      throw new BadRequestException("Loan is not pending pricing approval");
    }
    if (loan.makerUserId && loan.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot reject own pricing exception (segregation of duties)",
      );
    }
    await this.prisma.auditLogEntry
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          action: "LOAN_PRICING_REJECT",
          entity: "LoanContract",
          entityId: id,
          beforeJson: { status: loan.status },
          afterJson: { status: LoanStatus.CLOSED, checkerUserId },
          actorUserId: checkerUserId,
        },
      })
      .catch(() => undefined);
    return this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.CLOSED },
    });
  }

  /**
   * Floating rate reset: rebuild remaining unpaid installments only
   * (no retroactive rewrite of PAID rows).
   */
  async resetFloatingRate(loanId: string, asOfDate: Date = new Date()) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id: loanId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (loan.rateType !== "FLOATING" || !loan.indexKey) {
      throw new BadRequestException("Loan is not FLOATING");
    }

    const template = await this.prisma.productTemplate.findFirst({
      where: { id: loan.productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    const params = template
      ? (parseProductParams(template.kind, template.paramsJson) as LoanProductParams)
      : null;
    const rateAnnual = await this.rates.resolveEffectiveRate({
      indexKey: loan.indexKey,
      spreadBps: loan.spreadBps,
      rateFloor: params?.rateFloor,
      asOfDate,
    });

    const installments = await this.prisma.loanScheduleInstallment.findMany({
      where: { loanId, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { sequenceNo: "asc" },
    });
    const unpaid = installments.filter(
      (i) =>
        i.status !== InstallmentStatus.PAID &&
        i.status !== InstallmentStatus.WAIVED,
    );
    if (unpaid.length === 0) {
      return { loanId, reset: false, reason: "no_unpaid" };
    }

    const remainingPrincipal = unpaid.reduce(
      (s, i) => s + (i.principalMinor - i.paidPrincipalMinor),
      0n,
    );
    const startSeq = unpaid[0].sequenceNo;
    const scheduleKind =
      template?.kind === ProductKind.LOAN_DIFF ? "LOAN_DIFF" : "LOAN_ANNUITY";
    const rebuilt = await this.bumpScheduleWorkingDays(
      buildLoanSchedule({
        kind: scheduleKind,
        principalMinor:
          remainingPrincipal > 0n ? remainingPrincipal : loan.outstandingMinor,
        termMonths: unpaid.length,
        rateAnnual,
        startDate: asOfDate,
        dayCountConvention: loan.dayCountConvention,
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.loanScheduleInstallment.deleteMany({
        where: {
          loanId,
          id: { in: unpaid.map((u) => u.id) },
        },
      });
      for (const row of rebuilt) {
        await tx.loanScheduleInstallment.create({
          data: {
            bankOrgId: this.bankOrg.bankOrgId,
            loanId,
            sequenceNo: startSeq + row.sequenceNo - 1,
            dueDate: row.dueDate,
            principalMinor: row.principalMinor,
            interestMinor: row.interestMinor,
            status: InstallmentStatus.SCHEDULED,
          },
        });
      }
      const months = params?.resetFrequencyMonths ?? 3;
      await tx.loanContract.update({
        where: { id: loanId },
        data: {
          rateAnnual,
          nextResetDate: addMonthsUtc(asOfDate, months),
        },
      });
    });

    return { loanId, reset: true, rateAnnual };
  }

  async resetDueFloatingRates(asOfDate: Date = new Date()) {
    const due = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        rateType: "FLOATING",
        nextResetDate: { lte: asOfDate },
        status: {
          in: [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE],
        },
      },
    });
    const results: Array<{
      loanId: string;
      reset: boolean;
      reason?: string;
      rateAnnual?: number;
    }> = [];
    for (const loan of due) {
      results.push(await this.resetFloatingRate(loan.id, asOfDate));
    }
    return { reset: results.length, results };
  }

  schedule(id: string) {
    return this.prisma.loanScheduleInstallment.findMany({
      where: { loanId: id, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { sequenceNo: "asc" },
    });
  }

  async setCollateral(id: string, collateral: CollateralPayload) {
    const updated = await this.prisma.loanContract.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { collateralRef: serializeCollateral(collateral) },
    });
    if (updated.count === 0) throw new NotFoundException("Loan not found");
    return this.getById(id);
  }

  async setQualityFlags(id: string, qualityFlags: string[]) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    const cleaned = [...new Set(qualityFlags.map((f) => f.trim()).filter(Boolean))];
    return this.prisma.loanContract.update({
      where: { id },
      data: { qualityFlagsJson: cleaned },
    });
  }

  async disburse(id: string, accountId: string, makerUserId = "service") {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const { loanGl } = await this.productGlCodes(loan.productTemplateId);

    await this.postingEngine.post({
      reference: `LOAN-DISB-${id}`,
      idempotencyKey: `loan-disb-${id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: loanGl.id,
          branchId: account.branchId,
          debitMinor: loan.principalMinor,
          creditMinor: 0n,
          currency: loan.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: loan.principalMinor,
          currency: loan.currency,
        },
      ],
    });

    const updated = await this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.DISBURSED, accountId, disbursedAt: new Date() },
    });
    this.trackDebtStatusChange(
      id,
      loan.customerId,
      loan.status,
      LoanStatus.DISBURSED,
    );
    return updated;
  }

  async repay(
    id: string,
    amountMinor: bigint,
    makerUserId = "service",
    idempotencyKey?: string,
  ) {
    if (amountMinor <= 0n) {
      throw new BadRequestException("amountMinor must be positive");
    }
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (!loan.accountId)
      throw new NotFoundException("Loan has no disbursement account");

    const account = await this.prisma.account.findFirst({
      where: { id: loan.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const { loanGl, interestGl } = await this.productGlCodes(
      loan.productTemplateId,
    );

    const installments = await this.prisma.loanScheduleInstallment.findMany({
      where: { loanId: id, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { sequenceNo: "asc" },
    });

    const asOf = new Date();
    const unpaidFingerprint = installments
      .filter(
        (i) =>
          i.status !== InstallmentStatus.PAID &&
          i.status !== InstallmentStatus.WAIVED,
      )
      .map(
        (i) =>
          `${i.id}:${i.paidPrincipalMinor}:${i.paidInterestMinor}:${i.status}`,
      )
      .join("|");
    const stateHash = createHash("sha256")
      .update(
        `${amountMinor}|${loan.accruedPenaltyMinor}|${loan.outstandingMinor}|${unpaidFingerprint}`,
      )
      .digest("hex")
      .slice(0, 24);
    const stableKey =
      idempotencyKey?.trim() || `loan-repay-${id}-${stateHash}`;

    const productTpl = await this.prisma.productTemplate.findFirst({
      where: {
        id: loan.productTemplateId,
        bankOrgId: this.bankOrg.bankOrgId,
      },
      select: { paramsJson: true },
    });
    let { penaltyTotal, principalTotal, interestTotal, remainingUnallocated, patches } =
      allocateRepayment(installments, amountMinor, asOf, {
        accruedPenaltyMinor: loan.accruedPenaltyMinor,
        waterfall: repayWaterfallFromParams(productTpl?.paramsJson),
      });

    // Consume residual overpay: extra principal first, then interest income.
    if (remainingUnallocated > 0n) {
      const headroom =
        loan.outstandingMinor > principalTotal
          ? loan.outstandingMinor - principalTotal
          : 0n;
      const extraPrincipal =
        remainingUnallocated < headroom ? remainingUnallocated : headroom;
      principalTotal += extraPrincipal;
      remainingUnallocated -= extraPrincipal;
      if (remainingUnallocated > 0n) {
        interestTotal += remainingUnallocated;
        remainingUnallocated = 0n;
      }
    }

    const legs: Array<{
      accountId?: string;
      glAccountId: string;
      branchId: string;
      debitMinor: bigint;
      creditMinor: bigint;
      currency: string;
    }> = [
      {
        accountId: account.id,
        glAccountId: account.glAccountId,
        branchId: account.branchId,
        debitMinor: amountMinor,
        creditMinor: 0n,
        currency: loan.currency,
      },
    ];

    if (principalTotal > 0n) {
      legs.push({
        glAccountId: loanGl.id,
        branchId: account.branchId,
        debitMinor: 0n,
        creditMinor: principalTotal,
        currency: loan.currency,
      });
    }
    if (interestTotal > 0n) {
      legs.push({
        glAccountId: interestGl.id,
        branchId: account.branchId,
        debitMinor: 0n,
        creditMinor: interestTotal,
        currency: loan.currency,
      });
    }
    if (penaltyTotal > 0n) {
      legs.push({
        glAccountId: interestGl.id,
        branchId: account.branchId,
        debitMinor: 0n,
        creditMinor: penaltyTotal,
        currency: loan.currency,
      });
    }

    await this.postingEngine.post({
      reference: `LOAN-REPAY-${id}-${stableKey.slice(0, 48)}`,
      idempotencyKey: stableKey.slice(0, 191),
      valueDate: asOf,
      type: TxnType.INTEREST,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs,
      sideEffectsInTx: async (tx) => {
        for (const patch of patches) {
          await tx.loanScheduleInstallment.update({
            where: { id: patch.id },
            data: {
              paidPrincipalMinor: patch.paidPrincipalMinor,
              paidInterestMinor: patch.paidInterestMinor,
              status: patch.status,
              paidAt: patch.paidAt,
            },
          });
        }
        for (const inst of installments) {
          const patch = patches.find((p) => p.id === inst.id);
          const finalStatus = patch?.status ?? inst.status;
          if (
            finalStatus === InstallmentStatus.PAID ||
            finalStatus === InstallmentStatus.WAIVED
          ) {
            continue;
          }
          if (inst.dueDate.getTime() < asOf.getTime()) {
            await tx.loanScheduleInstallment.update({
              where: { id: inst.id },
              data: { status: InstallmentStatus.OVERDUE },
            });
          }
        }
        const outstanding = loan.outstandingMinor - principalTotal;
        const nextPenalty =
          loan.accruedPenaltyMinor > penaltyTotal
            ? loan.accruedPenaltyMinor - penaltyTotal
            : 0n;
        await tx.loanContract.update({
          where: { id },
          data: {
            outstandingMinor: outstanding < 0n ? 0n : outstanding,
            accruedPenaltyMinor: nextPenalty,
            status: outstanding <= 0n ? LoanStatus.CLOSED : LoanStatus.ACTIVE,
          },
        });
      },
    });

    return this.prisma.loanContract.findFirstOrThrow({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  async restructure(id: string, ifrs9Stage: number, actorUserId = "service") {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");

    await this.prisma.auditLogEntry
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          action: "LOAN_RESTRUCTURE",
          entity: "LoanContract",
          entityId: id,
          beforeJson: { ifrs9Stage: loan.ifrs9Stage },
          afterJson: { ifrs9Stage, actorUserId },
          actorUserId,
        },
      })
      .catch(() => undefined);

    await this.prisma.loanContract.update({
      where: { id },
      data: { ifrs9Stage, status: LoanStatus.ACTIVE },
    });
    return this.getById(id);
  }

  async listExposures() {
    const loans = await this.list();
    const enriched = await Promise.all(
      loans.map(async (loan) => {
        const risk = await this.enrichRisk(loan.id, loan.ifrs9Stage);
        return {
          id: loan.id,
          customerId: loan.customerId,
          outstandingMinor: loan.outstandingMinor.toString(),
          currency: loan.currency,
          ifrs9Stage: loan.ifrs9Stage,
          akbScore: loan.akbScore,
          collateral: parseCollateralRef(loan.collateralRef),
          ...risk,
        };
      }),
    );
    return enriched;
  }

  async runStaging() {
    const loans = await this.list();
    const updates: Array<{ id: string; from: number; to: number }> = [];
    for (const loan of loans) {
      const risk = await this.enrichRisk(loan.id, loan.ifrs9Stage);
      if (risk.suggestedIfrs9Stage !== loan.ifrs9Stage) {
        await this.prisma.loanContract.update({
          where: { id: loan.id },
          data: { ifrs9Stage: risk.suggestedIfrs9Stage },
        });
        updates.push({
          id: loan.id,
          from: loan.ifrs9Stage,
          to: risk.suggestedIfrs9Stage,
        });
      }
    }
    return { updated: updates.length, updates };
  }

  async accrueDailyInterest(businessDate: Date) {
    const dateKey = businessDateKey(businessDate);
    const contracts = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE],
        },
        outstandingMinor: { gt: 0n },
      },
    });

    let accruedCount = 0;
    let skippedCount = 0;
    let totalDailyMinor = 0n;

    for (const loan of contracts) {
      if (
        loan.lastAccrualDate &&
        businessDateKey(loan.lastAccrualDate) === dateKey
      ) {
        skippedCount += 1;
        continue;
      }

      const rate = Number(loan.rateAnnual);
      const daily = dailyLoanInterestMinor(
        loan.outstandingMinor,
        rate,
        loan.dayCountConvention,
      );
      if (daily <= 0n) {
        await this.prisma.loanContract.update({
          where: { id: loan.id },
          data: { lastAccrualDate: businessDate },
        });
        skippedCount += 1;
        continue;
      }

      // Accrual register and journal must stay aligned — no field bump without a posting.
      if (!loan.accountId) {
        skippedCount += 1;
        continue;
      }
      const account = await this.prisma.account.findFirst({
        where: { id: loan.accountId, bankOrgId: this.bankOrg.bankOrgId },
      });
      if (!account) {
        skippedCount += 1;
        continue;
      }
      const { loanGl, interestGl } = await this.productGlCodes(
        loan.productTemplateId,
      );
      const idempotencyKey = `loan-int-accrual-${loan.id}-${dateKey}`;
      await this.postingEngine.post({
        reference: `LOAN-INT-ACCRUAL-${loan.id}-${dateKey}`,
        idempotencyKey,
        valueDate: businessDate,
        type: TxnType.INTEREST,
        makerUserId: "eod-system",
        branchId: account.branchId,
        autoApprove: true,
        allowDuringEod: true,
        legs: [
          {
            glAccountId: loanGl.id,
            branchId: account.branchId,
            debitMinor: daily,
            creditMinor: 0n,
            currency: loan.currency,
          },
          {
            glAccountId: interestGl.id,
            branchId: account.branchId,
            debitMinor: 0n,
            creditMinor: daily,
            currency: loan.currency,
          },
        ],
        sideEffectsInTx: async (tx) => {
          await tx.loanContract.update({
            where: { id: loan.id },
            data: {
              accruedInterestMinor: loan.accruedInterestMinor + daily,
              lastAccrualDate: businessDate,
            },
          });
        },
      });

      accruedCount += 1;
      totalDailyMinor += daily;
    }

    return {
      date: dateKey,
      accruedCount,
      skippedCount,
      totalDailyMinor: totalDailyMinor.toString(),
    };
  }

  async accruePenalties(businessDate: Date) {
    const dateKey = businessDateKey(businessDate);
    const loans = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] },
        penaltyRateAnnual: { not: null },
      },
    });

    let penalizedCount = 0;
    let totalPenaltyMinor = 0n;

    for (const loan of loans) {
      const penaltyRate = loan.penaltyRateAnnual ?? 0;
      if (penaltyRate <= 0) continue;

      const installments = await this.prisma.loanScheduleInstallment.findMany({
        where: { loanId: loan.id, bankOrgId: this.bankOrg.bankOrgId },
      });
      let overdueBase = 0n;
      for (const inst of installments) {
        if (
          inst.dueDate.getTime() < businessDate.getTime() &&
          inst.status !== InstallmentStatus.PAID &&
          inst.status !== InstallmentStatus.WAIVED
        ) {
          overdueBase += overdueInstallmentBaseMinor(inst);
        }
      }
      if (overdueBase <= 0n) continue;

      const daily = dailyPenaltyMinor(
        overdueBase,
        penaltyRate,
        loan.dayCountConvention,
      );
      if (daily <= 0n) continue;

      await this.prisma.loanContract.update({
        where: { id: loan.id },
        data: {
          accruedPenaltyMinor: loan.accruedPenaltyMinor + daily,
        },
      });
      penalizedCount += 1;
      totalPenaltyMinor += daily;
    }

    return {
      date: dateKey,
      penalizedCount,
      totalPenaltyMinor: totalPenaltyMinor.toString(),
    };
  }

  private async rebuildUnpaidSchedule(
    loanId: string,
    loan: {
      productTemplateId: string;
      outstandingMinor: bigint;
      rateAnnual: { toString(): string } | number;
      dayCountConvention: string;
      gracePrincipalMonths: number;
      graceInterestMonths: number;
      repaymentFrequency: LoanRepaymentFrequency;
      firstDueDate: Date | null;
    },
    mode: "REDUCE_TERM" | "REDUCE_INSTALLMENT",
    asOfDate: Date,
  ) {
    return this.rebuildUnpaidScheduleInTx(this.prisma, loanId, loan, mode, asOfDate);
  }

  /** Rebuild unpaid schedule using an outer money tx (prepay atomicity). */
  private async rebuildUnpaidScheduleInTx(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    loanId: string,
    loan: {
      productTemplateId: string;
      outstandingMinor: bigint;
      rateAnnual: { toString(): string } | number;
      dayCountConvention: string;
      gracePrincipalMonths: number;
      graceInterestMonths: number;
      repaymentFrequency: LoanRepaymentFrequency;
      firstDueDate: Date | null;
    },
    mode: "REDUCE_TERM" | "REDUCE_INSTALLMENT",
    asOfDate: Date,
  ) {
    const installments = await tx.loanScheduleInstallment.findMany({
      where: { loanId, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { sequenceNo: "asc" },
    });
    const unpaid = installments.filter(
      (i: { status: string }) =>
        i.status !== InstallmentStatus.PAID &&
        i.status !== InstallmentStatus.WAIVED,
    );
    if (unpaid.length === 0) {
      return { rebuilt: false as const, schedule: [] as ScheduleRow[] };
    }

    const template = await tx.productTemplate.findFirst({
      where: { id: loan.productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    const scheduleKind =
      template?.kind === ProductKind.LOAN_DIFF ? "LOAN_DIFF" : "LOAN_ANNUITY";
    const rateAnnual = Number(loan.rateAnnual);

    let termMonths = unpaid.length;
    if (mode === "REDUCE_TERM" && scheduleKind === "LOAN_ANNUITY") {
      const monthlyRate = monthlyRateFactor(
        rateAnnual,
        normalizeDayCountConvention(loan.dayCountConvention),
      );
      const headPmt = Number(
        unpaid[0].principalMinor + unpaid[0].interestMinor,
      );
      if (monthlyRate > 0 && headPmt > 0) {
        const p = Number(loan.outstandingMinor);
        const nEstimate = Math.ceil(
          -Math.log(1 - (p * monthlyRate) / headPmt) / Math.log(1 + monthlyRate),
        );
        if (Number.isFinite(nEstimate) && nEstimate >= 1) {
          termMonths = Math.min(unpaid.length, Math.max(1, nEstimate));
        }
      }
    }

    const firstDueDate =
      loan.firstDueDate && loan.firstDueDate > asOfDate
        ? loan.firstDueDate
        : unpaid[0]?.dueDate ?? asOfDate;

    const rebuiltRaw = buildLoanSchedule({
      kind: scheduleKind,
      principalMinor: loan.outstandingMinor,
      termMonths,
      rateAnnual,
      startDate: asOfDate,
      firstDueDate,
      dayCountConvention: loan.dayCountConvention,
      gracePrincipalMonths: 0,
      graceInterestMonths: 0,
      repaymentFrequency:
        loan.repaymentFrequency as import("./loan-schedule.util").LoanRepaymentFrequency,
    });
    const rebuilt = await this.bumpScheduleWorkingDays(rebuiltRaw);

    const startSeq = unpaid[0].sequenceNo;
    await tx.loanScheduleInstallment.deleteMany({
      where: { loanId, id: { in: unpaid.map((u: { id: string }) => u.id) } },
    });
    for (const row of rebuilt) {
      await tx.loanScheduleInstallment.create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          loanId,
          sequenceNo: startSeq + row.sequenceNo - 1,
          dueDate: row.dueDate,
          principalMinor: row.principalMinor,
          interestMinor: row.interestMinor,
          status: InstallmentStatus.SCHEDULED,
        },
      });
    }

    return { rebuilt: true as const, schedule: rebuilt, termMonths };
  }

  async prepay(
    id: string,
    input: {
      amountMinor: bigint;
      mode: "REDUCE_TERM" | "REDUCE_INSTALLMENT";
      idempotencyKey?: string;
    },
    makerUserId = "service",
  ) {
    if (input.amountMinor <= 0n) {
      throw new BadRequestException("amountMinor must be positive");
    }
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (!loan.accountId) {
      throw new BadRequestException("Loan has no disbursement account");
    }
    if (input.amountMinor > loan.outstandingMinor) {
      throw new BadRequestException("Prepay amount exceeds outstanding principal");
    }

    const account = await this.prisma.account.findFirst({
      where: { id: loan.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const { loanGl } = await this.productGlCodes(loan.productTemplateId);
    const asOf = new Date();
    const stateHash = createHash("sha256")
      .update(
        `${input.amountMinor}|${input.mode}|${loan.outstandingMinor}|${loan.updatedAt.toISOString()}`,
      )
      .digest("hex")
      .slice(0, 24);
    const stableKey =
      input.idempotencyKey?.trim() || `loan-prepay-${id}-${stateHash}`;

    let scheduleResult: {
      rebuilt: boolean;
      schedule?: ScheduleRow[];
      termMonths?: number;
    } = { rebuilt: false };
    const newOutstanding = loan.outstandingMinor - input.amountMinor;

    await this.postingEngine.post({
      reference: `LOAN-PREPAY-${id}-${stateHash}`,
      idempotencyKey: stableKey.slice(0, 191),
      valueDate: asOf,
      type: TxnType.TRANSFER,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: input.amountMinor,
          creditMinor: 0n,
          currency: loan.currency,
        },
        {
          glAccountId: loanGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: input.amountMinor,
          currency: loan.currency,
        },
      ],
      sideEffectsInTx: async (tx) => {
        await tx.loanContract.update({
          where: { id },
          data: {
            outstandingMinor: newOutstanding,
            status:
              newOutstanding <= 0n
                ? LoanStatus.CLOSED
                : loan.status === LoanStatus.DISBURSED
                  ? LoanStatus.ACTIVE
                  : loan.status,
          },
        });
        if (newOutstanding > 0n) {
          scheduleResult = await this.rebuildUnpaidScheduleInTx(
            tx,
            id,
            { ...loan, outstandingMinor: newOutstanding },
            input.mode,
            asOf,
          );
        }
      },
    });

    return {
      loanId: id,
      mode: input.mode,
      principalPrepaidMinor: input.amountMinor.toString(),
      outstandingMinor: newOutstanding.toString(),
      schedule: scheduleResult,
      idempotencyKey: stableKey.slice(0, 191),
    };
  }
}
