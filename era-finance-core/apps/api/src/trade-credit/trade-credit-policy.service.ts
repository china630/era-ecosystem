import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  InvoiceStatus,
  Prisma,
  TradeCreditGrantStatus,
  TradeCreditPolicyGroup,
  TradeCreditProposedKind,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CronModuleGateService } from "../subscription/cron-module-gate.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { classifyTradeCredit } from "./trade-credit-classifier";
import { suggestTradeCreditLimit } from "./trade-credit-limit";
import { TradeCreditRequiredException } from "./trade-credit-required.exception";
import {
  DEFAULT_ORG_TRADE_CREDIT_POLICY,
  type OrgTradeCreditPolicyDefaults,
  type TradeCreditFeatureSnapshot,
  type TradeCreditPolicyGroupCode,
  type TradeCreditProposedKindCode,
} from "./trade-credit-policy.types";

const OPEN_AR_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.LOCKED_BY_SIGNATURE,
];

type FacilityPolicyRow = {
  id: string;
  organizationId: string;
  counterpartyId: string;
  creditLimit: Prisma.Decimal | number;
  stopList: boolean;
  policyGroup: TradeCreditPolicyGroup | null;
  policyGroupManual: TradeCreditPolicyGroup | null;
  policyReasonsJson: Prisma.JsonValue | null;
  policyComputedAt: Date | null;
  autoRaiseMuted: boolean;
  proposedLimit: Prisma.Decimal | number | null;
  proposedAt: Date | null;
  proposedKind?: TradeCreditProposedKind | null;
  suggestedLimit?: Prisma.Decimal | number | null;
  limitBeforeBlock: Prisma.Decimal | number | null;
};

@Injectable()
export class TradeCreditPolicyService {
  private readonly logger = new Logger(TradeCreditPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionAccessService,
    private readonly cronGate: CronModuleGateService,
  ) {}

  async assertSku(organizationId: string): Promise<void> {
    const ok = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TRADE_CREDIT_CONTROL,
    );
    if (!ok) {
      throw new TradeCreditRequiredException();
    }
  }

  async getOrCreateOrgPolicy(organizationId: string) {
    const existing = await this.prisma.tradeCreditPolicy.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;

    return this.prisma.tradeCreditPolicy.create({
      data: {
        organizationId,
        autoRaiseEnabled: DEFAULT_ORG_TRADE_CREDIT_POLICY.autoRaiseEnabled,
        autoDMaxDpd: DEFAULT_ORG_TRADE_CREDIT_POLICY.autoDMaxDpd,
        autoRaisePct: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.autoRaisePct,
        ),
        autoRaiseCapAzn: null,
        grantTtlHoursA: DEFAULT_ORG_TRADE_CREDIT_POLICY.grantTtlHoursA,
        grantTtlHoursB: DEFAULT_ORG_TRADE_CREDIT_POLICY.grantTtlHoursB,
        grantTtlHoursC: DEFAULT_ORG_TRADE_CREDIT_POLICY.grantTtlHoursC,
        groupCRequireConfirm:
          DEFAULT_ORG_TRADE_CREDIT_POLICY.groupCRequireConfirm,
        minPaidInvoices: DEFAULT_ORG_TRADE_CREDIT_POLICY.minPaidInvoices,
        enrichRiskyForcesD:
          DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichRiskyForcesD,
        enrichVoenInactiveForcesD:
          DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichVoenInactiveForcesD,
        limitK: new Prisma.Decimal(DEFAULT_ORG_TRADE_CREDIT_POLICY.limitK),
        trialLimitAzn: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.trialLimitAzn,
        ),
        suggestedCapAzn: null,
        groupMultB: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.groupMultB,
        ),
        groupMultC: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.groupMultC,
        ),
        partialPayHaircut: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.partialPayHaircut,
        ),
        partialPayThreshold: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.partialPayThreshold,
        ),
        concentrationHaircut: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.concentrationHaircut,
        ),
        concentrationThreshold: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.concentrationThreshold,
        ),
        enrichTtlDays: DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichTtlDays,
        enrichHaircut: new Prisma.Decimal(
          DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichHaircut,
        ),
        restoreProposalEnabled:
          DEFAULT_ORG_TRADE_CREDIT_POLICY.restoreProposalEnabled,
      },
    });
  }

  async getOrgPolicyDefaults(
    organizationId: string,
  ): Promise<OrgTradeCreditPolicyDefaults> {
    const row = await this.getOrCreateOrgPolicy(organizationId);
    return this.toDefaults(row);
  }

  async updateOrgPolicy(
    organizationId: string,
    patch: Partial<OrgTradeCreditPolicyDefaults>,
  ) {
    await this.assertSku(organizationId);
    await this.getOrCreateOrgPolicy(organizationId);

    if (patch.autoRaiseEnabled === true) {
      const cap =
        patch.autoRaiseCapAzn !== undefined
          ? patch.autoRaiseCapAzn
          : Number(
              (
                await this.prisma.tradeCreditPolicy.findUniqueOrThrow({
                  where: { organizationId },
                })
              ).autoRaiseCapAzn ?? NaN,
            );
      if (cap == null || Number.isNaN(cap) || cap <= 0) {
        throw new BadRequestException(
          "autoRaiseCapAzn is required when autoRaiseEnabled is true",
        );
      }
    }

    const updated = await this.prisma.tradeCreditPolicy.update({
      where: { organizationId },
      data: {
        ...(patch.autoRaiseEnabled !== undefined
          ? { autoRaiseEnabled: patch.autoRaiseEnabled }
          : {}),
        ...(patch.autoDMaxDpd !== undefined
          ? { autoDMaxDpd: patch.autoDMaxDpd }
          : {}),
        ...(patch.autoRaisePct !== undefined
          ? { autoRaisePct: new Prisma.Decimal(patch.autoRaisePct) }
          : {}),
        ...(patch.autoRaiseCapAzn !== undefined
          ? {
              autoRaiseCapAzn:
                patch.autoRaiseCapAzn == null
                  ? null
                  : new Prisma.Decimal(patch.autoRaiseCapAzn),
            }
          : {}),
        ...(patch.grantTtlHoursA !== undefined
          ? { grantTtlHoursA: patch.grantTtlHoursA }
          : {}),
        ...(patch.grantTtlHoursB !== undefined
          ? { grantTtlHoursB: patch.grantTtlHoursB }
          : {}),
        ...(patch.grantTtlHoursC !== undefined
          ? { grantTtlHoursC: patch.grantTtlHoursC }
          : {}),
        ...(patch.groupCRequireConfirm !== undefined
          ? { groupCRequireConfirm: patch.groupCRequireConfirm }
          : {}),
        ...(patch.minPaidInvoices !== undefined
          ? { minPaidInvoices: patch.minPaidInvoices }
          : {}),
        ...(patch.enrichRiskyForcesD !== undefined
          ? { enrichRiskyForcesD: patch.enrichRiskyForcesD }
          : {}),
        ...(patch.enrichVoenInactiveForcesD !== undefined
          ? { enrichVoenInactiveForcesD: patch.enrichVoenInactiveForcesD }
          : {}),
        ...(patch.limitK !== undefined
          ? { limitK: new Prisma.Decimal(patch.limitK) }
          : {}),
        ...(patch.trialLimitAzn !== undefined
          ? { trialLimitAzn: new Prisma.Decimal(patch.trialLimitAzn) }
          : {}),
        ...(patch.suggestedCapAzn !== undefined
          ? {
              suggestedCapAzn:
                patch.suggestedCapAzn == null
                  ? null
                  : new Prisma.Decimal(patch.suggestedCapAzn),
            }
          : {}),
        ...(patch.groupMultB !== undefined
          ? { groupMultB: new Prisma.Decimal(patch.groupMultB) }
          : {}),
        ...(patch.groupMultC !== undefined
          ? { groupMultC: new Prisma.Decimal(patch.groupMultC) }
          : {}),
        ...(patch.partialPayHaircut !== undefined
          ? { partialPayHaircut: new Prisma.Decimal(patch.partialPayHaircut) }
          : {}),
        ...(patch.partialPayThreshold !== undefined
          ? {
              partialPayThreshold: new Prisma.Decimal(
                patch.partialPayThreshold,
              ),
            }
          : {}),
        ...(patch.concentrationHaircut !== undefined
          ? {
              concentrationHaircut: new Prisma.Decimal(
                patch.concentrationHaircut,
              ),
            }
          : {}),
        ...(patch.concentrationThreshold !== undefined
          ? {
              concentrationThreshold: new Prisma.Decimal(
                patch.concentrationThreshold,
              ),
            }
          : {}),
        ...(patch.enrichTtlDays !== undefined
          ? { enrichTtlDays: patch.enrichTtlDays }
          : {}),
        ...(patch.enrichHaircut !== undefined
          ? { enrichHaircut: new Prisma.Decimal(patch.enrichHaircut) }
          : {}),
        ...(patch.restoreProposalEnabled !== undefined
          ? { restoreProposalEnabled: patch.restoreProposalEnabled }
          : {}),
      },
    });
    return this.toDefaults(updated);
  }

  effectiveGroup(
    facility: Pick<FacilityPolicyRow, "policyGroup" | "policyGroupManual">,
  ): TradeCreditPolicyGroupCode | null {
    const g = facility.policyGroupManual ?? facility.policyGroup;
    return g ? (g as TradeCreditPolicyGroupCode) : null;
  }

  async buildFeatures(
    organizationId: string,
    counterpartyId: string,
    creditLimit: number,
    openAr: number,
  ): Promise<TradeCreditFeatureSnapshot> {
    const todayUtc = utcToday();
    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        counterpartyId,
        status: { in: OPEN_AR_STATUSES },
        deletedAt: null,
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    let overdueAr = 0;
    let weightedDpdSum = 0;
    let maxOpenRemainder = 0;
    const dpds: number[] = [];
    for (const inv of openInvoices) {
      const rem = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (rem <= 0) continue;
      const dpd = daysPastDue(inv.dueDate, todayUtc);
      dpds.push(dpd);
      if (dpd > 0) overdueAr += rem;
      weightedDpdSum += Math.max(0, dpd) * rem;
      if (rem > maxOpenRemainder) maxOpenRemainder = rem;
    }

    const maxDpd = dpds.length ? Math.max(...dpds) : 0;
    const avgDpd =
      dpds.length > 0
        ? Math.round((dpds.reduce((s, d) => s + d, 0) / dpds.length) * 100) /
          100
        : 0;
    const weightedAvgDpd =
      openAr > 0
        ? Math.round((weightedDpdSum / openAr) * 100) / 100
        : 0;
    const overdueShare =
      openAr > 0
        ? Math.round((overdueAr / openAr) * 10000) / 10000
        : 0;
    const concentration =
      openAr > 0
        ? Math.round((maxOpenRemainder / openAr) * 10000) / 10000
        : 0;

    const paidInvoiceCount = await this.prisma.invoice.count({
      where: {
        organizationId,
        counterpartyId,
        status: InvoiceStatus.PAID,
        deletedAt: null,
      },
    });

    const lookback12m = new Date();
    lookback12m.setUTCMonth(lookback12m.getUTCMonth() - 12);

    const partialCount = await this.prisma.invoice.count({
      where: {
        organizationId,
        counterpartyId,
        status: InvoiceStatus.PARTIALLY_PAID,
        deletedAt: null,
        updatedAt: { gte: lookback12m },
      },
    });
    const paidIn12m = await this.prisma.invoice.count({
      where: {
        organizationId,
        counterpartyId,
        status: InvoiceStatus.PAID,
        deletedAt: null,
        updatedAt: { gte: lookback12m },
      },
    });
    const denom = partialCount + paidIn12m;
    const partialPayRatio =
      denom > 0
        ? Math.round((partialCount / denom) * 10000) / 10000
        : 0;

    const now = new Date();
    const last90Start = addUtcDays(now, -90);
    const prev90Start = addUtcDays(now, -180);
    const yoyLast90Start = addUtcDays(now, -365 - 90);
    const yoyLast90End = addUtcDays(now, -365);

    const [last90, prev90, same90LastYear] = await Promise.all([
      this.sumRecognizedRevenue(
        organizationId,
        counterpartyId,
        last90Start,
        now,
      ),
      this.sumRecognizedRevenue(
        organizationId,
        counterpartyId,
        prev90Start,
        last90Start,
      ),
      this.sumRecognizedRevenue(
        organizationId,
        counterpartyId,
        yoyLast90Start,
        yoyLast90End,
      ),
    ]);

    let turnoverTrend = 0;
    if (prev90 > 0) {
      turnoverTrend = Math.round((last90 / prev90 - 1) * 10000) / 10000;
    } else if (last90 > 0) {
      turnoverTrend = 1;
    }

    let turnoverTrendYoy: number | null = null;
    if (same90LastYear > 0) {
      turnoverTrendYoy =
        Math.round((last90 / same90LastYear - 1) * 10000) / 10000;
    }

    const utilization =
      creditLimit <= 0
        ? 1
        : Math.round((openAr / creditLimit) * 10000) / 10000;

    const policy = await this.getOrgPolicyDefaults(organizationId);
    const latestEnrich = await this.prisma.tradeCreditEnrichmentRun.findFirst({
      where: {
        organizationId,
        counterpartyId,
        billed: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        riskyTaxpayer: true,
        voenInactive: true,
        createdAt: true,
      },
    });

    const enrichAt = latestEnrich?.createdAt ?? null;
    const enrichAgeMs = enrichAt ? now.getTime() - enrichAt.getTime() : null;
    const enrichStale =
      enrichAgeMs == null
        ? false
        : enrichAgeMs > policy.enrichTtlDays * 24 * 60 * 60 * 1000;

    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId, deletedAt: null },
      select: { paymentTermsDays: true },
    });
    const paymentTermsDays =
      cp?.paymentTermsDays != null && cp.paymentTermsDays > 0
        ? cp.paymentTermsDays
        : 30;

    return {
      maxDpd,
      avgDpd,
      weightedAvgDpd,
      overdueShare,
      partialPayRatio,
      turnoverTrend,
      turnoverTrendYoy,
      utilization,
      paidInvoiceCount,
      openAr,
      creditLimit,
      maxOpenRemainder: roundMoney(maxOpenRemainder),
      concentration,
      recognizedLast90: roundMoney(last90),
      recognizedSame90LastYear: roundMoney(same90LastYear),
      paymentTermsDays,
      riskyTaxpayer: enrichStale
        ? null
        : (latestEnrich?.riskyTaxpayer ?? null),
      voenInactive: enrichStale
        ? null
        : (latestEnrich?.voenInactive ?? null),
      enrichAt: enrichAt?.toISOString() ?? null,
      enrichStale: latestEnrich != null ? enrichStale : false,
    };
  }

  async reclassifyCounterparty(
    organizationId: string,
    counterpartyId: string,
  ) {
    await this.assertSku(organizationId);

    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
    });
    if (!facility) {
      return { skipped: true as const, reason: "no_facility" };
    }

    const policy = await this.getOrgPolicyDefaults(organizationId);
    const openAr = await this.computeOpenAr(organizationId, counterpartyId);
    const creditLimit = Number(facility.creditLimit);
    const features = await this.buildFeatures(
      organizationId,
      counterpartyId,
      creditLimit,
      openAr,
    );
    const classified = classifyTradeCredit(features, policy);
    const now = new Date();

    const lastPaid = await this.prisma.invoice.findFirst({
      where: {
        organizationId,
        counterpartyId,
        status: InvoiceStatus.PAID,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { totalAmount: true },
    });
    const lastRecognizedInvoiceAmount = lastPaid
      ? Number(lastPaid.totalAmount)
      : null;

    if (classified.thinHistory && !facility.policyGroupManual) {
      const suggest = suggestTradeCreditLimit({
        features,
        policy,
        group: null,
        thinHistory: true,
        lastRecognizedInvoiceAmount,
      });
      const trialProposal =
        creditLimit <= 0 &&
        !suggest.withinDeadband &&
        suggest.kind === "TRIAL"
          ? {
              proposedLimit: new Prisma.Decimal(suggest.suggested),
              proposedAt: now,
              proposedKind: TradeCreditProposedKind.TRIAL,
            }
          : {
              proposedLimit: null,
              proposedAt: null,
              proposedKind: null,
            };

      await this.prisma.tradeCreditFacility.update({
        where: { id: facility.id },
        data: {
          policyGroup: null,
          policyReasonsJson: classified.reasons,
          policyComputedAt: now,
          suggestedLimit: new Prisma.Decimal(suggest.suggested),
          ...trialProposal,
        },
      });
      return {
        skipped: false as const,
        thinHistory: true,
        group: null,
        effectiveGroup: null,
        reasons: classified.reasons,
        features,
        suggestedLimit: suggest.suggested,
        proposedKind: trialProposal.proposedKind,
      };
    }

    const computedGroup = classified.group;
    const effective = (facility.policyGroupManual ??
      computedGroup) as TradeCreditPolicyGroupCode | null;

    const updateData: Prisma.TradeCreditFacilityUpdateInput = {
      policyGroup: computedGroup
        ? (computedGroup as TradeCreditPolicyGroup)
        : null,
      policyReasonsJson: classified.reasons,
      policyComputedAt: now,
    };

    if (effective === "D") {
      Object.assign(updateData, await this.applyGroupDBlock(facility));
      updateData.proposedLimit = null;
      updateData.proposedAt = null;
      updateData.proposedKind = null;
      updateData.suggestedLimit = new Prisma.Decimal(0);
    } else {
      const suggest = suggestTradeCreditLimit({
        features,
        policy,
        group: effective,
        thinHistory: false,
        lastRecognizedInvoiceAmount,
      });
      updateData.suggestedLimit = new Prisma.Decimal(suggest.suggested);

      // G: restore proposal when clean after DPD-driven block
      const restoreCandidate =
        policy.restoreProposalEnabled &&
        facility.policyGroupManual !== TradeCreditPolicyGroup.D &&
        facility.limitBeforeBlock != null &&
        Number(facility.limitBeforeBlock) > 0 &&
        features.maxDpd === 0 &&
        features.overdueShare === 0 &&
        (facility.stopList || creditLimit <= 0);

      if (restoreCandidate) {
        const restored = Number(facility.limitBeforeBlock);
        updateData.proposedLimit = new Prisma.Decimal(restored);
        updateData.proposedAt = now;
        updateData.proposedKind = TradeCreditProposedKind.RESTORE;
      } else if (effective === "A") {
        const alreadyA =
          facility.policyGroup === TradeCreditPolicyGroup.A ||
          facility.policyGroupManual === TradeCreditPolicyGroup.A;
        // H+: enrich haircut outranks A-raise % / auto bump (never raise a risky CP)
        if (
          suggest.kind === "ENRICH_HAIRCUT" &&
          !suggest.withinDeadband
        ) {
          updateData.proposedLimit = new Prisma.Decimal(
            Math.min(suggest.suggested, creditLimit),
          );
          updateData.proposedAt = now;
          updateData.proposedKind = TradeCreditProposedKind.ENRICH_HAIRCUT;
        } else {
          const aRaise = this.applyGroupARaise(facility, policy, {
            skipAutoBump: alreadyA,
          });
          Object.assign(updateData, aRaise);
          if (aRaise.proposedLimit != null) {
            updateData.proposedKind = TradeCreditProposedKind.A_RAISE;
          } else if (
            aRaise.creditLimit == null &&
            !suggest.withinDeadband &&
            suggest.kind
          ) {
            updateData.proposedLimit = new Prisma.Decimal(suggest.suggested);
            updateData.proposedAt = now;
            updateData.proposedKind =
              suggest.kind as TradeCreditProposedKind;
          }
        }
      } else if (!suggest.withinDeadband && suggest.kind) {
        // B/C or enrich haircut / WC
        if (suggest.kind === "ENRICH_HAIRCUT") {
          updateData.proposedLimit = new Prisma.Decimal(
            Math.min(suggest.suggested, creditLimit),
          );
        } else {
          updateData.proposedLimit = new Prisma.Decimal(suggest.suggested);
        }
        updateData.proposedAt = now;
        updateData.proposedKind = suggest.kind as TradeCreditProposedKind;
      }
    }

    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: updateData,
    });

    return {
      skipped: false as const,
      thinHistory: classified.thinHistory,
      group: computedGroup,
      effectiveGroup: effective,
      reasons: classified.reasons,
      features,
      suggestedLimit:
        updateData.suggestedLimit != null
          ? Number(updateData.suggestedLimit as Prisma.Decimal)
          : null,
      proposedKind: (updateData.proposedKind as TradeCreditProposedKindCode | null) ?? null,
    };
  }

  async reclassifyOrganization(organizationId: string) {
    await this.assertSku(organizationId);
    const facilities = await this.prisma.tradeCreditFacility.findMany({
      where: { organizationId },
      select: { counterpartyId: true },
    });
    const results = [];
    for (const f of facilities) {
      try {
        results.push({
          counterpartyId: f.counterpartyId,
          ...(await this.reclassifyCounterparty(
            organizationId,
            f.counterpartyId,
          )),
        });
      } catch (e) {
        results.push({
          counterpartyId: f.counterpartyId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return { count: results.length, results };
  }

  /**
   * Fire-and-forget reclassify after grant consume/void, payment allocation,
   * or invoice revenue recognize. Quiet no-op when SKU off or no facility.
   */
  scheduleReclassify(organizationId: string, counterpartyId: string): void {
    void (async () => {
      const on = await this.cronGate.isModuleOn(
        organizationId,
        ModuleEntitlement.TRADE_CREDIT_CONTROL,
      );
      if (!on) return;
      const facility = await this.prisma.tradeCreditFacility.findUnique({
        where: {
          organizationId_counterpartyId: { organizationId, counterpartyId },
        },
        select: { id: true },
      });
      if (!facility) return;
      await this.reclassifyCounterparty(organizationId, counterpartyId);
    })().catch((e) => {
      this.logger.warn(
        `scheduleReclassify failed org=${organizationId} cp=${counterpartyId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    });
  }

  @Cron("0 2 * * *", { timeZone: "Asia/Baku" })
  async runNightlyReclassify(): Promise<void> {
    const orgs = await this.prisma.tradeCreditFacility.findMany({
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    let ran = 0;
    for (const { organizationId } of orgs) {
      const on = await this.cronGate.isModuleOn(
        organizationId,
        ModuleEntitlement.TRADE_CREDIT_CONTROL,
      );
      if (!on) continue;
      try {
        await this.reclassifyOrganization(organizationId);
        await this.fillDecisionFollowups(organizationId);
        ran += 1;
      } catch (e) {
        this.logger.warn(
          `Nightly trade-credit reclassify failed org=${organizationId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    if (ran > 0) {
      this.logger.log(`Trade credit policy nightly: ${ran} org(s)`);
    }
  }

  async listLimitDecisions(organizationId: string, take = 50) {
    await this.assertSku(organizationId);
    const rows = await this.prisma.tradeCreditLimitDecision.findMany({
      where: { organizationId },
      orderBy: { decidedAt: "desc" },
      take: Math.min(100, Math.max(1, take)),
    });
    const acceptedWithFollowup = rows.filter(
      (r) => r.accepted && r.followupMaxDpd30 != null,
    );
    const hit =
      acceptedWithFollowup.length === 0
        ? null
        : acceptedWithFollowup.filter((r) => (r.followupMaxDpd30 ?? 99) <= 7)
            .length / acceptedWithFollowup.length;

    return {
      hitRate30d: hit,
      decisions: rows.map((r) => ({
        id: r.id,
        counterpartyId: r.counterpartyId,
        kind: r.kind,
        oldLimit: Number(r.oldLimit),
        newLimit: Number(r.newLimit),
        accepted: r.accepted,
        decidedAt: r.decidedAt.toISOString(),
        followupMaxDpd30: r.followupMaxDpd30,
        followupAt: r.followupAt?.toISOString() ?? null,
      })),
    };
  }

  private async fillDecisionFollowups(organizationId: string): Promise<void> {
    const cutoff = addUtcDays(new Date(), -30);
    const pending = await this.prisma.tradeCreditLimitDecision.findMany({
      where: {
        organizationId,
        accepted: true,
        followupAt: null,
        decidedAt: { lte: cutoff },
      },
      take: 200,
    });
    for (const row of pending) {
      const openAr = await this.computeOpenAr(
        organizationId,
        row.counterpartyId,
      );
      const features = await this.buildFeatures(
        organizationId,
        row.counterpartyId,
        Number(row.newLimit),
        openAr,
      );
      await this.prisma.tradeCreditLimitDecision.update({
        where: { id: row.id },
        data: {
          followupMaxDpd30: features.maxDpd,
          followupAt: new Date(),
        },
      });
    }
  }

  private async writeLimitDecision(params: {
    organizationId: string;
    counterpartyId: string;
    facilityId: string;
    kind: TradeCreditProposedKindCode;
    oldLimit: number;
    newLimit: number;
    accepted: boolean;
    reasons: string[];
    features: TradeCreditFeatureSnapshot;
  }): Promise<void> {
    try {
      await this.prisma.tradeCreditLimitDecision.create({
        data: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
          facilityId: params.facilityId,
          kind: params.kind as TradeCreditProposedKind,
          oldLimit: new Prisma.Decimal(params.oldLimit),
          newLimit: new Prisma.Decimal(params.newLimit),
          accepted: params.accepted,
          reasonsJson: params.reasons,
          featuresJson: {
            maxDpd: params.features.maxDpd,
            weightedAvgDpd: params.features.weightedAvgDpd,
            overdueShare: params.features.overdueShare,
            utilization: params.features.utilization,
            concentration: params.features.concentration,
            recognizedLast90: params.features.recognizedLast90,
            paymentTermsDays: params.features.paymentTermsDays,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(
        `writeLimitDecision failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async pinGroup(
    organizationId: string,
    counterpartyId: string,
    group: TradeCreditPolicyGroupCode | null,
  ) {
    await this.assertSku(organizationId);
    const facility = await this.requireFacility(organizationId, counterpartyId);

    if (group === null) {
      await this.prisma.tradeCreditFacility.update({
        where: { id: facility.id },
        data: { policyGroupManual: null },
      });
      return this.reclassifyCounterparty(organizationId, counterpartyId);
    }

    const updateData: Prisma.TradeCreditFacilityUpdateInput = {
      policyGroupManual: group as TradeCreditPolicyGroup,
    };
    if (group === "D") {
      Object.assign(updateData, await this.applyGroupDBlock(facility));
    }

    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: updateData,
    });

    return {
      counterpartyId,
      policyGroupManual: group,
      effectiveGroup: group,
    };
  }

  async acceptRaise(organizationId: string, counterpartyId: string) {
    await this.assertSku(organizationId);
    const facility = await this.requireFacility(organizationId, counterpartyId);
    if (facility.proposedLimit == null) {
      throw new BadRequestException("No proposed limit to accept");
    }
    const oldLimit = Number(facility.creditLimit);
    const newLimit = Number(facility.proposedLimit);
    const kind =
      (facility.proposedKind as TradeCreditProposedKindCode | null) ??
      "WORKING_CAPITAL";
    const features = await this.buildFeatures(
      organizationId,
      counterpartyId,
      oldLimit,
      await this.computeOpenAr(organizationId, counterpartyId),
    );

    const restoreExtras =
      kind === "RESTORE"
        ? {
            stopList: false,
            limitBeforeBlock: null,
          }
        : {};

    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: {
        creditLimit: new Prisma.Decimal(newLimit),
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
        ...restoreExtras,
      },
    });

    await this.writeLimitDecision({
      organizationId,
      counterpartyId,
      facilityId: facility.id,
      kind,
      oldLimit,
      newLimit,
      accepted: true,
      reasons: Array.isArray(facility.policyReasonsJson)
        ? (facility.policyReasonsJson as string[])
        : [],
      features,
    });

    return {
      counterpartyId,
      creditLimit: newLimit,
      proposedLimit: null,
      proposedKind: null,
    };
  }

  async rejectRaise(organizationId: string, counterpartyId: string) {
    await this.assertSku(organizationId);
    const facility = await this.requireFacility(organizationId, counterpartyId);
    const oldLimit = Number(facility.creditLimit);
    const proposed =
      facility.proposedLimit != null ? Number(facility.proposedLimit) : oldLimit;
    const kind =
      (facility.proposedKind as TradeCreditProposedKindCode | null) ??
      "WORKING_CAPITAL";
    const features = await this.buildFeatures(
      organizationId,
      counterpartyId,
      oldLimit,
      await this.computeOpenAr(organizationId, counterpartyId),
    );

    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: {
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
      },
    });

    if (facility.proposedLimit != null) {
      await this.writeLimitDecision({
        organizationId,
        counterpartyId,
        facilityId: facility.id,
        kind,
        oldLimit,
        newLimit: proposed,
        accepted: false,
        reasons: Array.isArray(facility.policyReasonsJson)
          ? (facility.policyReasonsJson as string[])
          : [],
        features,
      });
    }

    return {
      counterpartyId,
      proposedLimit: null,
      proposedKind: null,
      creditLimit: oldLimit,
    };
  }

  async restoreAfterBlock(organizationId: string, counterpartyId: string) {
    await this.assertSku(organizationId);
    const facility = await this.requireFacility(organizationId, counterpartyId);
    if (facility.limitBeforeBlock == null) {
      throw new BadRequestException("No limitBeforeBlock snapshot to restore");
    }
    const restored = Number(facility.limitBeforeBlock);
    const clearDPin = facility.policyGroupManual === TradeCreditPolicyGroup.D;
    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: {
        creditLimit: new Prisma.Decimal(restored),
        stopList: false,
        limitBeforeBlock: null,
        ...(clearDPin ? { policyGroupManual: null } : {}),
      },
    });
    // Resume computed group; do not leave effective D with stop cleared
    const reclass = await this.reclassifyCounterparty(
      organizationId,
      counterpartyId,
    );
    return {
      counterpartyId,
      creditLimit: restored,
      stopList: false,
      limitBeforeBlock: null,
      policyGroupManual: clearDPin ? null : facility.policyGroupManual,
      reclassify: reclass,
    };
  }

  async setAutoRaiseMuted(
    organizationId: string,
    counterpartyId: string,
    muted: boolean,
  ) {
    await this.assertSku(organizationId);
    const facility = await this.requireFacility(organizationId, counterpartyId);
    await this.prisma.tradeCreditFacility.update({
      where: { id: facility.id },
      data: { autoRaiseMuted: muted },
    });
    return {
      counterpartyId,
      autoRaiseMuted: muted,
    };
  }

  private applyGroupARaise(
    facility: FacilityPolicyRow,
    policy: OrgTradeCreditPolicyDefaults,
    opts?: { skipAutoBump?: boolean },
  ): Prisma.TradeCreditFacilityUpdateInput {
    const limit = Number(facility.creditLimit);
    if (limit <= 0) return {};

    const bumped = limit * (1 + policy.autoRaisePct / 100);
    const canAuto =
      policy.autoRaiseEnabled &&
      !facility.autoRaiseMuted &&
      policy.autoRaiseCapAzn != null &&
      policy.autoRaiseCapAzn > 0;

    // First transition into A may auto-bump once; staying A must not compound nightly
    if (canAuto && !opts?.skipAutoBump) {
      const capped = Math.min(bumped, policy.autoRaiseCapAzn!);
      if (capped <= limit) return {};
      void this.writeAutoRaiseAudit(facility, limit, capped).catch(() => undefined);
      return {
        creditLimit: new Prisma.Decimal(roundMoney(capped)),
        proposedLimit: null,
        proposedAt: null,
      };
    }

    if (canAuto && opts?.skipAutoBump) {
      return {};
    }

    // Proposal path (auto-raise off, muted, or no cap)
    let proposed = bumped;
    if (policy.autoRaiseCapAzn != null && policy.autoRaiseCapAzn > 0) {
      proposed = Math.min(proposed, policy.autoRaiseCapAzn);
    }
    if (proposed <= limit) return {};
    return {
      proposedLimit: new Prisma.Decimal(roundMoney(proposed)),
      proposedAt: new Date(),
    };
  }

  private async applyGroupDBlock(
    facility: FacilityPolicyRow,
  ): Promise<Prisma.TradeCreditFacilityUpdateInput> {
    const limit = Number(facility.creditLimit);
    const alreadyBlocked =
      facility.stopList &&
      limit <= 0 &&
      facility.limitBeforeBlock != null;

    const data: Prisma.TradeCreditFacilityUpdateInput = {
      stopList: true,
      creditLimit: new Prisma.Decimal(0),
    };

    if (!alreadyBlocked && facility.limitBeforeBlock == null && limit > 0) {
      data.limitBeforeBlock = new Prisma.Decimal(limit);
    }

    await this.prisma.tradeCreditGrant.updateMany({
      where: {
        organizationId: facility.organizationId,
        counterpartyId: facility.counterpartyId,
        status: TradeCreditGrantStatus.ISSUED,
      },
      data: { status: TradeCreditGrantStatus.VOID },
    });

    return data;
  }

  private async writeAutoRaiseAudit(
    facility: FacilityPolicyRow,
    oldLimit: number,
    newLimit: number,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: facility.organizationId,
          userId: null,
          entityType: "trade_credit.facility",
          entityId: facility.id,
          action: "auto_raise",
          oldValues: { creditLimit: oldLimit },
          newValues: {
            creditLimit: newLimit,
            counterpartyId: facility.counterpartyId,
          },
        },
      });
    } catch {
      // Audit is best-effort for Phase 1
    }
  }

  private async requireFacility(
    organizationId: string,
    counterpartyId: string,
  ): Promise<FacilityPolicyRow> {
    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
    });
    if (!facility) {
      throw new NotFoundException("Trade credit facility not found");
    }
    return facility;
  }

  private async computeOpenAr(
    organizationId: string,
    counterpartyId: string,
  ): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        counterpartyId,
        status: { in: OPEN_AR_STATUSES },
        deletedAt: null,
      },
      select: { totalAmount: true, paidAmount: true },
    });
    let open = 0;
    for (const inv of invoices) {
      const rem = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (rem > 0) open += rem;
    }
    return roundMoney(open);
  }

  private async sumRecognizedRevenue(
    organizationId: string,
    counterpartyId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        counterpartyId,
        deletedAt: null,
        OR: [
          { revenueRecognized: true, recognizedAt: { gte: from, lt: to } },
          {
            recognizedAt: { not: null, gte: from, lt: to },
          },
        ],
      },
      select: { totalAmount: true },
    });
    return rows.reduce((s, r) => s + Number(r.totalAmount), 0);
  }

  private toDefaults(row: {
    autoRaiseEnabled: boolean;
    autoDMaxDpd: number;
    autoRaisePct: Prisma.Decimal | number;
    autoRaiseCapAzn: Prisma.Decimal | number | null;
    grantTtlHoursA: number;
    grantTtlHoursB: number;
    grantTtlHoursC: number;
    groupCRequireConfirm: boolean;
    minPaidInvoices: number;
    enrichRiskyForcesD?: boolean;
    enrichVoenInactiveForcesD?: boolean;
    limitK?: Prisma.Decimal | number;
    trialLimitAzn?: Prisma.Decimal | number;
    suggestedCapAzn?: Prisma.Decimal | number | null;
    groupMultB?: Prisma.Decimal | number;
    groupMultC?: Prisma.Decimal | number;
    partialPayHaircut?: Prisma.Decimal | number;
    partialPayThreshold?: Prisma.Decimal | number;
    concentrationHaircut?: Prisma.Decimal | number;
    concentrationThreshold?: Prisma.Decimal | number;
    enrichTtlDays?: number;
    enrichHaircut?: Prisma.Decimal | number;
    restoreProposalEnabled?: boolean;
  }): OrgTradeCreditPolicyDefaults {
    const n = (v: Prisma.Decimal | number | undefined, d: number) =>
      v == null ? d : Number(v);
    return {
      autoRaiseEnabled: row.autoRaiseEnabled,
      autoDMaxDpd: row.autoDMaxDpd,
      autoRaisePct: Number(row.autoRaisePct),
      autoRaiseCapAzn:
        row.autoRaiseCapAzn == null ? null : Number(row.autoRaiseCapAzn),
      grantTtlHoursA: row.grantTtlHoursA,
      grantTtlHoursB: row.grantTtlHoursB,
      grantTtlHoursC: row.grantTtlHoursC,
      groupCRequireConfirm: row.groupCRequireConfirm,
      minPaidInvoices: row.minPaidInvoices,
      enrichRiskyForcesD: row.enrichRiskyForcesD ?? false,
      enrichVoenInactiveForcesD: row.enrichVoenInactiveForcesD ?? false,
      limitK: n(row.limitK, DEFAULT_ORG_TRADE_CREDIT_POLICY.limitK),
      trialLimitAzn: n(
        row.trialLimitAzn,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.trialLimitAzn,
      ),
      suggestedCapAzn:
        row.suggestedCapAzn == null ? null : Number(row.suggestedCapAzn),
      groupMultB: n(row.groupMultB, DEFAULT_ORG_TRADE_CREDIT_POLICY.groupMultB),
      groupMultC: n(row.groupMultC, DEFAULT_ORG_TRADE_CREDIT_POLICY.groupMultC),
      partialPayHaircut: n(
        row.partialPayHaircut,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.partialPayHaircut,
      ),
      partialPayThreshold: n(
        row.partialPayThreshold,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.partialPayThreshold,
      ),
      concentrationHaircut: n(
        row.concentrationHaircut,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.concentrationHaircut,
      ),
      concentrationThreshold: n(
        row.concentrationThreshold,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.concentrationThreshold,
      ),
      enrichTtlDays:
        row.enrichTtlDays ?? DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichTtlDays,
      enrichHaircut: n(
        row.enrichHaircut,
        DEFAULT_ORG_TRADE_CREDIT_POLICY.enrichHaircut,
      ),
      restoreProposalEnabled:
        row.restoreProposalEnabled ??
        DEFAULT_ORG_TRADE_CREDIT_POLICY.restoreProposalEnabled,
    };
  }
}

function utcToday(): Date {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
}

function daysPastDue(dueDate: Date, todayUtc: Date): number {
  const due = new Date(
    Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate(),
    ),
  );
  const ms = todayUtc.getTime() - due.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function roundMoney(n: number): number {
  return Math.round(n * 10000) / 10000;
}
