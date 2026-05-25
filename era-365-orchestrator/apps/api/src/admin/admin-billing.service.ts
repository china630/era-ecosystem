import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TariffTier } from "@era365/database";
import type { TierQuotas } from "../constants/quotas";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import type { AdminSubscriptionPatchDto } from "./dto/admin-subscription-patch.dto";
import type { PatchBillingGlobalLimitsDto } from "./dto/patch-billing-global-limits.dto";
import type { PatchBillingPricingCatalogDto } from "./dto/patch-billing-pricing-catalog.dto";
import type {
  CreatePricingBundleDto,
  UpdatePricingBundleDto,
} from "./dto/pricing-bundle.dto";
import type { PatchPricingBundleTrialConfigDto } from "./dto/pricing-bundle-trial-config.dto";
import type { PatchFoundationDto } from "./dto/patch-foundation.dto";
import type { PatchOcrJobsPerOrgMonthDto } from "./dto/patch-ocr-jobs-per-org-month.dto";
import type { PatchPricingModulePriceDto } from "./dto/patch-pricing-module-price.dto";
import type { PatchQuotaUnitPricingDto } from "./dto/patch-quota-unit-pricing.dto";
import type { PatchYearlyDiscountDto } from "./dto/patch-yearly-discount.dto";
import type { SetBillingPriceDto } from "./dto/set-billing-price.dto";
import type { PatchMeterUnitPricingDto } from "./dto/patch-meter-unit-pricing.dto";
import type { PatchTierSpendCeilingsDto } from "./dto/patch-tier-spend-ceilings.dto";
import type { SetTierQuotasDto } from "./dto/set-tier-quotas.dto";
import {
  DEFAULT_TIER_SPEND_CEILINGS_AZN,
  TIER_SPEND_CEILING_KEYS,
} from "../billing/tier-spend-ceiling";
import {
  quotasMatrixToRecord,
  type SetBillingQuotasMatrixDto,
} from "./dto/set-billing-quotas-matrix.dto";
import { enrichPublicPricingStorefront } from "../billing/pricing-storefront-snapshot.util";
import { PricingService } from "./pricing.service";

const BILLING_SYSTEM_KEYS = {
  foundation: "billing.foundation_monthly_azn",
  yearlyDiscount: "billing.yearly_discount_percent",
  quotaUnitPricing: "billing.quota_unit_pricing_v1",
  ocrJobsPerOrgMonth: "quota.ocr_jobs_per_org_month_v1",
} as const;

const TIER_LEGACY_PRICE_KEYS: Record<TariffTier, string> = {
  TIER_0: "billing.price.TIER_0",
  TIER_1: "billing.price.TIER_1",
  TIER_2: "billing.price.TIER_2",
  TIER_3: "billing.price.TIER_3",
};

const tierQuotaConfigKey = (tier: TariffTier) => `quota.tier.${tier}`;

function pricingBundleTrialPatch(
  trial: PatchPricingBundleTrialConfigDto | undefined,
): Prisma.PricingBundleUpdateInput {
  if (!trial) return {};
  const data: Prisma.PricingBundleUpdateInput = {};
  if (trial.isTrialDefault !== undefined) {
    data.isTrialDefault = trial.isTrialDefault;
  }
  if (trial.trialDurationDays !== undefined) {
    data.trialDurationDays =
      trial.trialDurationDays === null ? null : trial.trialDurationDays;
  }
  if (trial.trialQuotas !== undefined) {
    data.trialQuotas =
      trial.trialQuotas === null
        ? Prisma.DbNull
        : (trial.trialQuotas as Prisma.InputJsonValue);
  }
  return data;
}

function parseExpiresAtFromDto(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException("Invalid expiresAt: could not parse as date");
  }
  return d;
}

function serializePricingModule(m: {
  id: string;
  key: string;
  name: string;
  pricePerMonth: unknown;
  sortOrder: number;
  isPremium: boolean;
}) {
  return {
    id: m.id,
    key: m.key,
    name: m.name,
    pricePerMonth: Number(m.pricePerMonth),
    sortOrder: m.sortOrder,
    isPremium: m.isPremium,
  };
}

function serializePricingBundle(b: {
  id: string;
  name: string;
  discountPercent: unknown;
  moduleKeys: unknown;
  isTrialDefault?: boolean;
  trialDurationDays?: number | null;
  trialQuotas?: unknown;
}) {
  const keys = b.moduleKeys;
  return {
    id: b.id,
    name: b.name,
    discountPercent: Number(b.discountPercent),
    moduleKeys: Array.isArray(keys) ? keys.map(String) : [],
    isTrialDefault: Boolean(b.isTrialDefault),
    trialDurationDays: b.trialDurationDays ?? null,
    trialQuotas:
      b.trialQuotas != null && typeof b.trialQuotas === "object"
        ? (b.trialQuotas as Record<string, unknown>)
        : null,
  };
}

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly pricing: PricingService,
  ) {}

  async patchSubscription(
    organizationId: string,
    dto: AdminSubscriptionPatchDto,
  ) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });
    if (!existing) {
      throw new NotFoundException("Organization not found");
    }

    let expiresAt: Date | null | undefined = undefined;
    if (dto.expiresAt !== undefined) {
      expiresAt =
        dto.expiresAt === null || dto.expiresAt === ""
          ? null
          : parseExpiresAtFromDto(String(dto.expiresAt).trim());
    }
    if (dto.extendMonths != null && dto.extendMonths > 0) {
      const sub = existing.subscription;
      const base =
        sub?.expiresAt && sub.expiresAt > new Date()
          ? sub.expiresAt
          : new Date();
      const d = new Date(base);
      d.setMonth(d.getMonth() + dto.extendMonths);
      expiresAt = d;
    }

    const data: Prisma.OrganizationSubscriptionUncheckedUpdateInput = {};
    if (dto.isBlocked !== undefined) {
      data.isBlocked = dto.isBlocked;
    }
    if (dto.tier !== undefined) {
      data.currentTier = dto.tier;
    }
    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt;
    }
    if (dto.activeModules !== undefined) {
      data.activeModules = dto.activeModules;
    }
    if (dto.isTrial !== undefined) {
      data.isTrial = dto.isTrial;
    }

    if (existing.subscription) {
      if (Object.keys(data).length === 0) {
        throw new BadRequestException("Nothing to update");
      }
      return this.prisma.organizationSubscription.update({
        where: { organizationId },
        data,
      });
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    return this.prisma.organizationSubscription.create({
      data: {
        organizationId,
        currentTier: dto.tier ?? TariffTier.TIER_1,
        isTrial: false,
        isBlocked: dto.isBlocked ?? false,
        expiresAt: expiresAt ?? null,
        activeModules: dto.activeModules ?? [],
      },
    });
  }

  async getBillingConfig() {
    const prices = await this.systemConfig.getAllBillingPrices();
    const tiers = Object.keys(prices) as TariffTier[];
    const quotas: Record<string, TierQuotas> = {};
    for (const t of tiers) {
      quotas[t] = await this.systemConfig.getTierQuotas(t);
    }
    const constructorData = await this.pricing.getConstructorData();
    const [
      yearlyDiscountPercent,
      quotaPricing,
      meterUnitPricing,
      tierSpendCeilings,
      pricingBundles,
      ocrJobsPerOrgMonth,
    ] = await Promise.all([
      this.systemConfig.getYearlyDiscountPercent(),
      this.systemConfig.getQuotaUnitPricing(),
      this.systemConfig.getMeterUnitPricing(),
      this.getTierSpendCeilings(),
      this.prisma.pricingBundle.findMany({ orderBy: { updatedAt: "desc" } }),
      this.systemConfig.getOcrJobsPerOrgMonthLimit(),
    ]);
    return {
      prices,
      quotas,
      ocrJobsPerOrgMonth,
      foundationMonthlyAzn: constructorData.basePrice,
      yearlyDiscountPercent,
      quotaPricing,
      meterUnitPricing,
      tierSpendCeilings,
      basePrice: constructorData.basePrice,
      pricingModules: constructorData.modules.map((m) =>
        serializePricingModule({
          id: m.id,
          key: m.key,
          name: m.name,
          pricePerMonth: m.pricePerMonth,
          sortOrder: m.sortOrder,
          isPremium: m.isPremium,
        }),
      ),
      pricingBundles: pricingBundles.map(serializePricingBundle),
    };
  }

  /**
   * Read-only marketing snapshot: no JWT, no org secrets.
   * Omits module/bundle UUIDs and trial quota JSON from bundles.
   */
  async getPublicPricingSnapshot() {
    const config = await this.getBillingConfig();
    const pricingModules = config.pricingModules.map((m) => ({
      key: m.key,
      name: m.name,
      pricePerMonth: m.pricePerMonth,
      sortOrder: m.sortOrder,
      isPremium: m.isPremium,
    }));
    const pricingBundles = config.pricingBundles.map((b) => ({
      name: b.name,
      discountPercent: b.discountPercent,
      moduleKeys: b.moduleKeys,
      isTrialDefault: Boolean(b.isTrialDefault),
      trialDurationDays: b.trialDurationDays ?? null,
    }));
    const storefront = enrichPublicPricingStorefront({
      foundationMonthlyAzn: config.foundationMonthlyAzn,
      pricingModules,
      pricingBundles,
      tierSpendCeilingsAzn: config.tierSpendCeilings,
      meterUnitPricing: config.meterUnitPricing,
    });
    return {
      currency: "AZN" as const,
      foundationMonthlyAzn: config.foundationMonthlyAzn,
      yearlyDiscountPercent: config.yearlyDiscountPercent,
      pricingModules,
      pricingBundles,
      meterUnitPricing: config.meterUnitPricing,
      tierSpendCeilings: config.tierSpendCeilings,
      ocrJobsPerOrgMonth: config.ocrJobsPerOrgMonth,
      standardModules: storefront.standardModules,
      premiumModules: storefront.premiumModules,
      bundles: storefront.bundles,
      tiers: storefront.tiers,
    };
  }

  async getTierSpendCeilings(): Promise<Record<TariffTier, number>> {
    const tiers = Object.keys(TIER_SPEND_CEILING_KEYS) as TariffTier[];
    const out = { ...DEFAULT_TIER_SPEND_CEILINGS_AZN };
    for (const tier of tiers) {
      const raw = await this.systemConfig.getJson(TIER_SPEND_CEILING_KEYS[tier]);
      if (typeof raw === "number" && Number.isFinite(raw)) out[tier] = raw;
      else if (typeof raw === "string") {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) out[tier] = n;
      }
    }
    return out;
  }

  async patchMeterUnitPricing(dto: PatchMeterUnitPricingDto) {
    const meterUnitPricing = await this.systemConfig.setMeterUnitPricing(dto);
    return { ok: true as const, meterUnitPricing };
  }

  async patchTierSpendCeilings(dto: PatchTierSpendCeilingsDto) {
    const tiers: TariffTier[] = [
      TariffTier.TIER_0,
      TariffTier.TIER_1,
      TariffTier.TIER_2,
      TariffTier.TIER_3,
    ];
    for (const tier of tiers) {
      const v = dto[tier];
      await this.systemConfig.setJson(
        TIER_SPEND_CEILING_KEYS[tier],
        Math.max(0, v),
      );
    }
    const tierSpendCeilings = await this.getTierSpendCeilings();
    return { ok: true as const, tierSpendCeilings };
  }

  async seedPricingCatalogDefaults() {
    const modules = await this.pricing.resetPricingCatalogToDefaults();
    return {
      ok: true as const,
      pricingModules: modules.map((m) =>
        serializePricingModule({
          id: m.id,
          key: m.key,
          name: m.name,
          pricePerMonth: m.pricePerMonth,
          sortOrder: m.sortOrder,
          isPremium: m.isPremium,
        }),
      ),
    };
  }

  async patchFoundation(dto: PatchFoundationDto) {
    await this.systemConfig.setFoundationMonthlyAzn(dto.amountAzn);
    return { ok: true, foundationMonthlyAzn: dto.amountAzn };
  }

  async patchBillingPricingCatalog(dto: PatchBillingPricingCatalogDto) {
    const keys = [...new Set(dto.modules.map((m) => m.key))];
    const found = await this.prisma.pricingModule.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });
    if (found.length !== keys.length) {
      throw new BadRequestException(
        "pricing-catalog: unknown or duplicate module keys",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: { key: BILLING_SYSTEM_KEYS.foundation },
        create: {
          key: BILLING_SYSTEM_KEYS.foundation,
          value: dto.foundationMonthlyAzn,
        },
        update: { value: dto.foundationMonthlyAzn },
      });
      for (const m of dto.modules) {
        await tx.pricingModule.update({
          where: { key: m.key },
          data: {
            pricePerMonth: m.pricePerMonth,
            isPremium: m.isPremium,
          },
        });
      }
    });
    await this.pricing.refreshPremiumModuleKeys();
    return { ok: true as const };
  }

  async patchBillingGlobalLimits(dto: PatchBillingGlobalLimitsDto) {
    await this.prisma.$transaction(async (tx) => {
      const upsert = (key: string, value: unknown) =>
        tx.systemConfig.upsert({
          where: { key },
          create: { key, value: value as object },
          update: { value: value as object },
        });
      await upsert(
        BILLING_SYSTEM_KEYS.yearlyDiscount,
        dto.yearlyDiscountPercent,
      );
      await upsert(
        BILLING_SYSTEM_KEYS.ocrJobsPerOrgMonth,
        dto.ocrJobsPerOrgMonth,
      );
      await upsert(BILLING_SYSTEM_KEYS.quotaUnitPricing, dto.quotaPricing);
      const tiers = Object.keys(TIER_LEGACY_PRICE_KEYS) as TariffTier[];
      for (const tier of tiers) {
        await upsert(
          TIER_LEGACY_PRICE_KEYS[tier],
          dto.tierPrices[tier],
        );
      }
    });
    return { ok: true as const };
  }

  async patchYearlyDiscount(dto: PatchYearlyDiscountDto) {
    await this.systemConfig.setYearlyDiscountPercent(dto.percent);
    return { ok: true, yearlyDiscountPercent: dto.percent };
  }

  async patchQuotaUnitPricing(dto: PatchQuotaUnitPricingDto) {
    const quotaPricing = await this.systemConfig.setQuotaUnitPricing(dto);
    return { ok: true, quotaPricing };
  }

  async patchPricingModulePrice(idOrKey: string, dto: PatchPricingModulePriceDto) {
    const raw = idOrKey.trim();
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw,
      );
    const row = await this.prisma.pricingModule.update({
      where: looksLikeUuid ? { id: raw } : { key: raw },
      data: { pricePerMonth: dto.pricePerMonth },
    });
    return serializePricingModule(row);
  }

  async createPricingBundle(dto: CreatePricingBundleDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pricingBundle.create({
        data: {
          name: dto.name.trim(),
          discountPercent: dto.discountPercent,
          moduleKeys: dto.moduleKeys,
        },
      });
      if (dto.trial?.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: created.id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      const trialData = pricingBundleTrialPatch(dto.trial);
      if (Object.keys(trialData).length > 0) {
        return tx.pricingBundle.update({
          where: { id: created.id },
          data: trialData,
        });
      }
      return created;
    });
    return serializePricingBundle(row);
  }

  async updatePricingBundle(id: string, dto: UpdatePricingBundleDto) {
    const data: Prisma.PricingBundleUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.discountPercent !== undefined) {
      data.discountPercent = dto.discountPercent;
    }
    if (dto.moduleKeys !== undefined) {
      data.moduleKeys = dto.moduleKeys;
    }
    Object.assign(data, pricingBundleTrialPatch(dto.trial));
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.trial?.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data,
      });
    });
    return serializePricingBundle(row);
  }

  async patchPricingBundleTrialConfig(
    id: string,
    dto: PatchPricingBundleTrialConfigDto,
  ) {
    const trialData = pricingBundleTrialPatch(dto);
    if (Object.keys(trialData).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data: trialData,
      });
    });
    return serializePricingBundle(row);
  }

  async deletePricingBundle(id: string) {
    await this.prisma.pricingBundle.delete({ where: { id } });
    return { ok: true };
  }

  async setBillingPrice(dto: SetBillingPriceDto) {
    await this.systemConfig.setBillingPriceAzn(dto.tier, dto.amountAzn);
    return { ok: true, tier: dto.tier, amountAzn: dto.amountAzn };
  }

  async patchOcrJobsPerOrgMonth(dto: PatchOcrJobsPerOrgMonthDto) {
    await this.systemConfig.setOcrJobsPerOrgMonthLimit(dto.limit);
    const ocrJobsPerOrgMonth =
      await this.systemConfig.getOcrJobsPerOrgMonthLimit();
    return { ok: true as const, ocrJobsPerOrgMonth };
  }

  async setTierQuotas(dto: SetTierQuotasDto) {
    const current = await this.systemConfig.getTierQuotas(dto.tier);
    const merged: TierQuotas = {
      maxEmployees:
        dto.quotas.maxEmployees !== undefined
          ? dto.quotas.maxEmployees
          : current.maxEmployees,
      maxInvoicesPerMonth:
        dto.quotas.maxInvoicesPerMonth !== undefined
          ? dto.quotas.maxInvoicesPerMonth
          : current.maxInvoicesPerMonth,
      maxStorageGb:
        dto.quotas.maxStorageGb !== undefined
          ? dto.quotas.maxStorageGb
          : current.maxStorageGb,
      maxWhatsappAlertsPerMonth:
        dto.quotas.maxWhatsappAlertsPerMonth !== undefined
          ? dto.quotas.maxWhatsappAlertsPerMonth
          : current.maxWhatsappAlertsPerMonth,
      maxOcrPagesPerMonth:
        dto.quotas.maxOcrPagesPerMonth !== undefined
          ? dto.quotas.maxOcrPagesPerMonth
          : current.maxOcrPagesPerMonth,
      maxWorkspaces:
        dto.quotas.maxWorkspaces !== undefined
          ? dto.quotas.maxWorkspaces
          : current.maxWorkspaces,
    };
    const key = tierQuotaConfigKey(dto.tier);
    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: { key },
        create: { key, value: merged as object },
        update: { value: merged as object },
      });
    });
    return { ok: true, tier: dto.tier, quotas: merged };
  }

  async setBillingQuotasMatrix(dto: SetBillingQuotasMatrixDto) {
    const byTier = quotasMatrixToRecord(dto.quotas);
    await this.prisma.$transaction(async (tx) => {
      for (const tier of Object.keys(byTier) as TariffTier[]) {
        const merged = this.mergeTierQuotasFromDto(byTier[tier]);
        const key = tierQuotaConfigKey(tier);
        await tx.systemConfig.upsert({
          where: { key },
          create: { key, value: merged as object },
          update: { value: merged as object },
        });
      }
    });
    return { ok: true as const, quotas: byTier };
  }

  private mergeTierQuotasFromDto(dto: SetTierQuotasDto["quotas"]): TierQuotas {
    const fields: (keyof TierQuotas)[] = [
      "maxEmployees",
      "maxInvoicesPerMonth",
      "maxStorageGb",
      "maxWhatsappAlertsPerMonth",
      "maxOcrPagesPerMonth",
      "maxWorkspaces",
    ];
    const out = {} as TierQuotas;
    for (const field of fields) {
      if (dto[field] === undefined) {
        throw new BadRequestException(`Missing quota field: ${field}`);
      }
      out[field] = dto[field] ?? null;
    }
    return out;
  }
}
