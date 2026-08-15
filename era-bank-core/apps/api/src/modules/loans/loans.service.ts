import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  InstallmentStatus,
  LoanStatus,
  ProductKind,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode } from "../../common/product-gl";
import { normalizeDayCountConvention } from "../../common/interest-daycount.util";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { ProductFactoryService } from "../../kernel/product-factory/product-factory.service";
import { RateIndexService } from "../../kernel/rates/rate-index.service";
import {
  addMonthsUtc,
  parseProductParams,
  resolveRateAndTerm,
  type LoanProductParams,
} from "../../kernel/product-factory/product-params";
import { createCreditBureauAdapter } from "./bureau.adapter";
import { buildLoanSchedule } from "./loan-schedule.util";
import { allocateRepayment } from "./loan-repay.util";
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
  ) {}

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
    return {
      ...loan,
      collateral: parseCollateralRef(loan.collateralRef),
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
    return {
      daysPastDue,
      suggestedIfrs9Stage: suggestedStage,
      isNpl: daysPastDue >= 90 || currentStage >= 3,
    };
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
    const schedule = buildLoanSchedule({
      kind: scheduleKind,
      principalMinor: input.principalMinor,
      termMonths,
      rateAnnual,
      dayCountConvention,
    });

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
          invoiceRef: input.invoiceRef ?? null,
          tradeRef: input.tradeRef ?? null,
          projectRef: input.projectRef ?? null,
          participationPct: input.participationPct ?? null,
          leadBankName: input.leadBankName ?? null,
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
    return this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.APPROVED },
    });
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
    const rebuilt = buildLoanSchedule({
      kind: scheduleKind,
      principalMinor: remainingPrincipal > 0n ? remainingPrincipal : loan.outstandingMinor,
      termMonths: unpaid.length,
      rateAnnual,
      startDate: asOfDate,
      dayCountConvention: loan.dayCountConvention,
    });

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

    return this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.DISBURSED, accountId, disbursedAt: new Date() },
    });
  }

  async repay(id: string, amountMinor: bigint, makerUserId = "service") {
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
    let { principalTotal, interestTotal, remainingUnallocated, patches } =
      allocateRepayment(installments, amountMinor, asOf);

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

    await this.postingEngine.post({
      reference: `LOAN-REPAY-${id}-${Date.now()}`,
      idempotencyKey: `loan-repay-${id}-${amountMinor}-${Date.now()}`,
      valueDate: asOf,
      type: TxnType.INTEREST,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs,
    });

    for (const patch of patches) {
      await this.prisma.loanScheduleInstallment.update({
        where: { id: patch.id },
        data: {
          paidPrincipalMinor: patch.paidPrincipalMinor,
          paidInterestMinor: patch.paidInterestMinor,
          status: patch.status,
          paidAt: patch.paidAt,
        },
      });
    }

    // Mark remaining past-due unpaid installments OVERDUE (MVP: repay path only).
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
        await this.prisma.loanScheduleInstallment.update({
          where: { id: inst.id },
          data: { status: InstallmentStatus.OVERDUE },
        });
      }
    }

    const outstanding = loan.outstandingMinor - principalTotal;
    return this.prisma.loanContract.update({
      where: { id },
      data: {
        outstandingMinor: outstanding < 0n ? 0n : outstanding,
        status: outstanding <= 0n ? LoanStatus.CLOSED : LoanStatus.ACTIVE,
      },
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
}
