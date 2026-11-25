import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DepositStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode, tryProductGlCode } from "../../common/product-gl";
import { normalizeDayCountConvention } from "../../common/interest-daycount.util";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { ProductFactoryService } from "../../kernel/product-factory/product-factory.service";
import { RateIndexService } from "../../kernel/rates/rate-index.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";
import {
  addMonthsUtc,
  parseProductParams,
  resolveRateAndTerm,
  type DepositProductParams,
} from "../../kernel/product-factory/product-params";
import {
  businessDateKey,
  dailyDepositInterestMinor,
} from "./deposit-interest.util";
import { computeDepositInterestWht } from "./deposit-interest-wht.util";

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly products: ProductFactoryService,
    private readonly systemGl: SystemGlConfigService,
    private readonly rates: RateIndexService,
  ) {}

  list(status?: DepositStatus) {
    return this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: "desc" },
    });
  }

  listPendingPricing() {
    return this.list(DepositStatus.PENDING_PRICING_APPROVAL);
  }

  getById(id: string) {
    return this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  /**
   * Lab WHT registry for finance handoff (JSON). Not live e-taxes submit (P1-7).
   */
  async listWhtRegistry() {
    const rows = await this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        taxAccruedMinor: { gt: 0n },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        customerId: true,
        productTemplateId: true,
        currency: true,
        status: true,
        taxAccruedMinor: true,
        monthInterestAccruedMinor: true,
        updatedAt: true,
        openedAt: true,
      },
    });
    return {
      labOnly: true,
      notLiveETaxes: true,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        ...r,
        taxAccruedMinor: r.taxAccruedMinor.toString(),
        monthInterestAccruedMinor: r.monthInterestAccruedMinor.toString(),
      })),
    };
  }

  private async glByCode(code: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!gl) throw new NotFoundException(`GL ${code} not seeded`);
    return gl;
  }

  private async termLiabilityGl(productTemplateId: string) {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const code = getProductGlCode(template.paramsJson, "glLiabilityCode");
    return this.glByCode(code);
  }

  private async interestExpenseGl(productTemplateId: string) {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const code = tryProductGlCode(template.paramsJson, "glInterestExpenseCode");
    if (code) return this.glByCode(code);
    return this.systemGl.resolve(SystemGlKey.INTEREST_EXPENSE);
  }

  private async depositProductParams(
    productTemplateId: string,
  ): Promise<DepositProductParams | null> {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) return null;
    return parseProductParams(
      template.kind,
      template.paramsJson,
    ) as DepositProductParams;
  }

  private async tryDepositInterestTaxPayableGl() {
    try {
      return await this.systemGl.resolve(SystemGlKey.DEPOSIT_INTEREST_TAX_PAYABLE);
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
  }

  private async resolveContractRate(
    params: DepositProductParams,
    requestedRateAnnual: number | undefined,
    pricing: {
      allowException?: boolean;
      exceptionReason?: string;
    },
  ) {
    const resolved = resolveRateAndTerm({
      templateTermMonths: params.termMonths,
      templateRateAnnual: params.rateAnnual,
      bands: {
        termMonthsMin: params.termMonthsMin,
        termMonthsMax: params.termMonthsMax,
        rateAnnualMin: params.rateAnnualMin,
        rateAnnualMax: params.rateAnnualMax,
      },
      requestedTermMonths: undefined,
      requestedRateAnnual,
      allowException: pricing.allowException,
      exceptionReason: pricing.exceptionReason,
    });

    let rateAnnual = resolved.rateAnnual;
    const rateType = params.rateType === "FLOATING" ? "FLOATING" : "FIXED";
    if (rateType === "FLOATING" && params.indexKey) {
      rateAnnual = await this.rates.resolveEffectiveRate({
        indexKey: params.indexKey,
        spreadBps: params.spreadBps,
        rateFloor: params.rateFloor,
      });
    }
    return { ...resolved, rateAnnual, rateType };
  }

  async open(input: {
    accountId: string;
    customerId: string;
    productTemplateId: string;
    principalMinor: bigint;
    currency?: string;
    maturityDate?: Date;
    termMonths?: number;
    rateAnnual?: number;
    makerUserId?: string;
    idempotencyKey?: string;
    pricingException?: boolean;
    exceptionReason?: string;
  }) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const template = await this.products.assertActiveDepositProduct(
      input.productTemplateId,
    );
    const params = parseProductParams(
      template.kind,
      template.paramsJson,
    ) as DepositProductParams;

    const termResolved = resolveRateAndTerm({
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

    const rateType = params.rateType === "FLOATING" ? "FLOATING" : "FIXED";
    let rateAnnual = termResolved.rateAnnual;
    if (rateType === "FLOATING" && params.indexKey) {
      rateAnnual = await this.rates.resolveEffectiveRate({
        indexKey: params.indexKey,
        spreadBps: params.spreadBps,
        rateFloor: params.rateFloor,
      });
    }

    const convention = normalizeDayCountConvention(params.dayCountConvention);
    const currency = template.currency;
    const maturityDate =
      input.maturityDate ?? addMonthsUtc(new Date(), termResolved.termMonths);
    const nextResetDate =
      rateType === "FLOATING" && params.resetFrequencyMonths
        ? addMonthsUtc(new Date(), params.resetFrequencyMonths)
        : null;

    const pending = termResolved.pricingException;
    const status = pending
      ? DepositStatus.PENDING_PRICING_APPROVAL
      : DepositStatus.ACTIVE;

    if (!pending) {
      const termGl = await this.termLiabilityGl(input.productTemplateId);
      const idempotencyKey = input.idempotencyKey ?? `dep-open-${Date.now()}`;
      await this.postingEngine.post({
        reference: `DEP-OPEN-${idempotencyKey}`,
        idempotencyKey: `dep-post-${idempotencyKey}`,
        valueDate: new Date(),
        type: TxnType.DEPOSIT,
        makerUserId: input.makerUserId ?? "service",
        branchId: account.branchId,
        autoApprove: true,
        legs: [
          {
            accountId: account.id,
            glAccountId: account.glAccountId,
            branchId: account.branchId,
            debitMinor: input.principalMinor,
            creditMinor: 0n,
            currency,
          },
          {
            glAccountId: termGl.id,
            branchId: account.branchId,
            debitMinor: 0n,
            creditMinor: input.principalMinor,
            currency,
          },
        ],
      });
    }

    return this.prisma.depositContract.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        accountId: input.accountId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        principalMinor: input.principalMinor,
        rateAnnual,
        dayCountConvention: convention,
        rateType,
        indexKey: params.indexKey ?? null,
        spreadBps: params.spreadBps ?? null,
        nextResetDate,
        currency,
        openedAt: new Date(),
        maturityDate,
        status,
        adifTagged: params.adifEligible === true,
        indexLinkKey:
          typeof (template.paramsJson as Record<string, unknown>).indexLinkKey ===
          "string"
            ? String((template.paramsJson as Record<string, unknown>).indexLinkKey)
            : null,
        callNoticeDays:
          typeof (template.paramsJson as Record<string, unknown>).callNoticeDays ===
          "number"
            ? Number((template.paramsJson as Record<string, unknown>).callNoticeDays)
            : null,
        makerUserId: input.makerUserId ?? "service",
        pricingExceptionReason: pending ? input.exceptionReason ?? null : null,
      },
    });
  }

  async pricingApprove(id: string, checkerUserId: string) {
    const dep = await this.getById(id);
    if (!dep) throw new NotFoundException("Deposit not found");
    if (dep.status !== DepositStatus.PENDING_PRICING_APPROVAL) {
      throw new BadRequestException("Deposit is not pending pricing approval");
    }
    if (dep.makerUserId && dep.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot approve own pricing exception (segregation of duties)",
      );
    }

    const account = await this.prisma.account.findFirst({
      where: { id: dep.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");
    const termGl = await this.termLiabilityGl(dep.productTemplateId);

    await this.postingEngine.post({
      reference: `DEP-OPEN-APPROVED-${id}`,
      idempotencyKey: `dep-post-approved-${id}`,
      valueDate: new Date(),
      type: TxnType.DEPOSIT,
      makerUserId: dep.makerUserId ?? "service",
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: dep.principalMinor,
          creditMinor: 0n,
          currency: dep.currency,
        },
        {
          glAccountId: termGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: dep.principalMinor,
          currency: dep.currency,
        },
      ],
    });

    await this.prisma.auditLogEntry.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        action: "DEPOSIT_PRICING_APPROVE",
        entity: "DepositContract",
        entityId: id,
        beforeJson: { status: dep.status },
        afterJson: { status: DepositStatus.ACTIVE, checkerUserId },
        actorUserId: checkerUserId,
      },
    }).catch(() => undefined);

    return this.prisma.depositContract.update({
      where: { id },
      data: { status: DepositStatus.ACTIVE },
    });
  }

  async pricingReject(id: string, checkerUserId: string) {
    const dep = await this.getById(id);
    if (!dep) throw new NotFoundException("Deposit not found");
    if (dep.status !== DepositStatus.PENDING_PRICING_APPROVAL) {
      throw new BadRequestException("Deposit is not pending pricing approval");
    }
    if (dep.makerUserId && dep.makerUserId === checkerUserId) {
      throw new ForbiddenException(
        "Maker cannot reject own pricing exception (segregation of duties)",
      );
    }
    await this.prisma.auditLogEntry.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        action: "DEPOSIT_PRICING_REJECT",
        entity: "DepositContract",
        entityId: id,
        beforeJson: { status: dep.status },
        afterJson: { status: DepositStatus.CLOSED, checkerUserId },
        actorUserId: checkerUserId,
      },
    }).catch(() => undefined);
    return this.prisma.depositContract.update({
      where: { id },
      data: { status: DepositStatus.CLOSED },
    });
  }

  async accrueDailyInterest(businessDate: Date) {
    const dateKey = businessDateKey(businessDate);
    const contracts = await this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: DepositStatus.ACTIVE,
      },
    });

    let accruedCount = 0;
    let skippedCount = 0;
    let totalDailyMinor = 0n;

    for (const dep of contracts) {
      if (
        dep.lastAccrualDate &&
        businessDateKey(dep.lastAccrualDate) === dateKey
      ) {
        skippedCount += 1;
        continue;
      }

      const rate = Number(dep.rateAnnual);
      const daily = dailyDepositInterestMinor(
        dep.principalMinor,
        rate,
        dep.dayCountConvention,
      );
      if (daily <= 0n) {
        await this.prisma.depositContract.update({
          where: { id: dep.id },
          data: { lastAccrualDate: businessDate },
        });
        skippedCount += 1;
        continue;
      }

      const account = await this.prisma.account.findFirst({
        where: { id: dep.accountId, bankOrgId: this.bankOrg.bankOrgId },
      });
      if (!account) continue;

      const termGl = await this.termLiabilityGl(dep.productTemplateId);
      const expenseGl = await this.interestExpenseGl(dep.productTemplateId);
      const idempotencyKey = `dep-accrual-${dep.id}-${dateKey}`;

      const productParams = await this.depositProductParams(dep.productTemplateId);
      const monthKey = dateKey.slice(0, 7);
      let whtMinor = 0n;
      let netInterest = daily;
      let monthInterestAccruedMinor = dep.monthInterestAccruedMinor;
      let interestAccrualMonth = dep.interestAccrualMonth;

      if (
        productParams?.taxExemptMonthlyMinor != null &&
        productParams.depositInterestTaxRate != null
      ) {
        const wht = computeDepositInterestWht({
          dailyInterestMinor: daily,
          monthInterestAccruedMinor: dep.monthInterestAccruedMinor,
          accrualMonthKey: dep.interestAccrualMonth ?? "",
          businessMonthKey: monthKey,
          taxExemptMonthlyMinor: productParams.taxExemptMonthlyMinor,
          depositInterestTaxRate: productParams.depositInterestTaxRate,
          termMonths: productParams.termMonths,
          exemptIfTermMonths: productParams.exemptIfTermMonths,
        });
        whtMinor = wht.whtMinor;
        netInterest = wht.netInterestMinor;
        monthInterestAccruedMinor = wht.monthInterestAccruedMinor;
        interestAccrualMonth = monthKey;
      }

      const legs: Array<{
        glAccountId: string;
        branchId: string;
        debitMinor: bigint;
        creditMinor: bigint;
        currency: string;
      }> = [
        {
          glAccountId: expenseGl.id,
          branchId: account.branchId,
          debitMinor: daily,
          creditMinor: 0n,
          currency: dep.currency,
        },
        {
          glAccountId: termGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: netInterest,
          currency: dep.currency,
        },
      ];

      const taxGl =
        whtMinor > 0n ? await this.tryDepositInterestTaxPayableGl() : null;
      if (whtMinor > 0n && taxGl) {
        legs.push({
          glAccountId: taxGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: whtMinor,
          currency: dep.currency,
        });
      } else if (whtMinor > 0n && !taxGl) {
        legs[1] = {
          ...legs[1],
          creditMinor: daily,
        };
      }

      await this.postingEngine.post({
        reference: `DEP-ACCRUAL-${dep.id}-${dateKey}`,
        idempotencyKey,
        valueDate: businessDate,
        type: TxnType.INTEREST,
        makerUserId: "eod-system",
        branchId: account.branchId,
        autoApprove: true,
        allowDuringEod: true,
        legs,
      });

      await this.prisma.depositContract.update({
        where: { id: dep.id },
        data: {
          accruedInterestMinor: dep.accruedInterestMinor + netInterest,
          taxAccruedMinor: dep.taxAccruedMinor + whtMinor,
          monthInterestAccruedMinor,
          interestAccrualMonth,
          lastAccrualDate: businessDate,
        },
      });

      accruedCount += 1;
      totalDailyMinor += netInterest;
    }

    return {
      date: dateKey,
      accruedCount,
      skippedCount,
      totalDailyMinor: totalDailyMinor.toString(),
    };
  }

  async resetFloatingRates(asOfDate: Date = new Date()) {
    const due = await this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: DepositStatus.ACTIVE,
        rateType: "FLOATING",
        nextResetDate: { lte: asOfDate },
        indexKey: { not: null },
      },
    });
    let reset = 0;
    for (const dep of due) {
      if (!dep.indexKey) continue;
      const template = await this.prisma.productTemplate.findFirst({
        where: { id: dep.productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
      });
      const params = template
        ? (parseProductParams(template.kind, template.paramsJson) as DepositProductParams)
        : null;
      const rateAnnual = await this.rates.resolveEffectiveRate({
        indexKey: dep.indexKey,
        spreadBps: dep.spreadBps,
        rateFloor: params?.rateFloor,
        asOfDate,
      });
      const months = params?.resetFrequencyMonths ?? 3;
      await this.prisma.depositContract.update({
        where: { id: dep.id },
        data: {
          rateAnnual,
          nextResetDate: addMonthsUtc(asOfDate, months),
        },
      });
      reset += 1;
    }
    return { reset };
  }

  async close(id: string, makerUserId = "service") {
    const dep = await this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!dep) throw new NotFoundException("Deposit not found");
    if (dep.status === DepositStatus.PENDING_PRICING_APPROVAL) {
      throw new BadRequestException("Cannot close pending pricing deposit");
    }

    const account = await this.prisma.account.findFirst({
      where: { id: dep.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const termGl = await this.termLiabilityGl(dep.productTemplateId);
    const payout = dep.principalMinor + dep.accruedInterestMinor;

    await this.postingEngine.post({
      reference: `DEP-CLOSE-${id}`,
      idempotencyKey: `dep-close-${id}`,
      valueDate: new Date(),
      type: TxnType.DEPOSIT,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: termGl.id,
          branchId: account.branchId,
          debitMinor: payout,
          creditMinor: 0n,
          currency: dep.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: payout,
          currency: dep.currency,
        },
      ],
    });

    return this.prisma.depositContract.update({
      where: { id },
      data: {
        status: DepositStatus.EARLY_CLOSED,
        accruedInterestMinor: 0n,
      },
    });
  }

  async rollover(id: string, newMaturityDate: Date) {
    const dep = await this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!dep) throw new NotFoundException("Deposit not found");
    return this.prisma.depositContract.update({
      where: { id },
      data: {
        maturityDate: newMaturityDate,
        status: DepositStatus.ACTIVE,
        principalMinor: dep.principalMinor + dep.accruedInterestMinor,
        accruedInterestMinor: 0n,
      },
    });
  }

  /**
   * ADİF depositor registry snapshot (P2-5 deepen). Official ADIF file layout [U].
   */
  async buildAdifDepositorRegistrySnapshot(asOf = new Date()) {
    const contracts = await this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        adifTagged: true,
        status: { in: [DepositStatus.ACTIVE, DepositStatus.MATURED] },
      },
      select: {
        id: true,
        customerId: true,
        accountId: true,
        principalMinor: true,
        accruedInterestMinor: true,
        currency: true,
        openedAt: true,
        maturityDate: true,
        productTemplateId: true,
        status: true,
      },
      orderBy: { openedAt: "asc" },
    });
    const insuredMinorCap = 30_000_000n;
    /** Lab contribution estimate: 0.05% of insured balances annualized (stub). */
    const contributionRateAnnual = 0.0005;
    const byCustomer = new Map<
      string,
      {
        customerId: string;
        contracts: typeof contracts;
        balanceMinor: bigint;
        insuredMinor: bigint;
      }
    >();
    for (const row of contracts) {
      const balanceMinor = row.principalMinor + row.accruedInterestMinor;
      const bucket = byCustomer.get(row.customerId) ?? {
        customerId: row.customerId,
        contracts: [],
        balanceMinor: 0n,
        insuredMinor: 0n,
      };
      bucket.contracts.push(row);
      bucket.balanceMinor += balanceMinor;
      byCustomer.set(row.customerId, bucket);
    }
    const depositors = [...byCustomer.values()].map((bucket) => {
      const insuredMinor =
        bucket.balanceMinor > insuredMinorCap
          ? insuredMinorCap
          : bucket.balanceMinor;
      bucket.insuredMinor = insuredMinor;
      const contributionEstimateMinor = BigInt(
        Math.round(Number(insuredMinor) * contributionRateAnnual),
      );
      return {
        customerId: bucket.customerId,
        contractCount: bucket.contracts.length,
        currency: "AZN",
        balanceMinor: bucket.balanceMinor.toString(),
        insuredMinor: insuredMinor.toString(),
        contributionEstimateMinor: contributionEstimateMinor.toString(),
        contracts: bucket.contracts.map((row) => ({
          depositContractId: row.id,
          accountId: row.accountId,
          productTemplateId: row.productTemplateId,
          status: row.status,
          currency: row.currency,
          principalMinor: row.principalMinor.toString(),
          accruedInterestMinor: row.accruedInterestMinor.toString(),
          openedAt: row.openedAt.toISOString(),
          maturityDate: row.maturityDate?.toISOString() ?? null,
        })),
      };
    });
    const totalInsuredMinor = depositors.reduce(
      (acc, d) => acc + BigInt(d.insuredMinor),
      0n,
    );
    const totalContributionEstimateMinor = depositors.reduce(
      (acc, d) => acc + BigInt(d.contributionEstimateMinor),
      0n,
    );
    return {
      scaffold: false,
      partial: true,
      schemaVersion: "ADIF-DEPOSITOR-REGISTRY-LAB-2",
      asOf: asOf.toISOString(),
      capMinorPerDepositor: insuredMinorCap.toString(),
      contributionRateAnnual,
      totals: {
        depositorCount: depositors.length,
        contractCount: contracts.length,
        totalInsuredMinor: totalInsuredMinor.toString(),
        totalContributionEstimateMinor:
          totalContributionEstimateMinor.toString(),
      },
      depositors,
      note: "Official ADIF file / contribution remain [U] — lab snapshot only (P2-5).",
    };
  }
}
