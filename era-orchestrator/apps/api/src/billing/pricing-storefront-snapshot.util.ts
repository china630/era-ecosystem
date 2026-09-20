import { CAPACITY_DRIVERS, inferSatelliteKeyFromModuleKey, TariffTier } from "@era365/database";
import type { MeterUnitPricing, QuotaUnitPricing } from "../system-config/system-config.service";
import {
  PRICING_STANDARD_MODULE_REGISTRY,
  PRICING_STOREFRONT_BUNDLE_MARKETING,
} from "./pricing-storefront.catalog";
import { PRICING_HOSPITALITY_BUNDLE_MARKETING } from "./pricing-hospitality.catalog";
import {
  INDUSTRY_STOREFRONT_GROUP_ORDER,
  PRICING_INDUSTRY_BUNDLE_MARKETING,
  bundleIndustrySatelliteKey,
  isWorkforcePlatformKey,
} from "./pricing-industry.catalog";

const ALL_BUNDLE_MARKETING = [
  ...PRICING_STOREFRONT_BUNDLE_MARKETING,
  ...PRICING_HOSPITALITY_BUNDLE_MARKETING,
  ...PRICING_INDUSTRY_BUNDLE_MARKETING,
];

export type PublicPricingModuleRow = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  isPremium: boolean;
  satelliteKey?: string | null;
};

export type PublicPricingBundleRow = {
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  isTrialDefault: boolean;
  trialDurationDays: number | null;
};

export type PublicStandardModuleRow = {
  id: string;
  moduleKeys: string[];
  pricePerMonthAzn: number;
};

export type PublicBundleStorefrontRow = PublicPricingBundleRow & {
  marketingId: string;
  listPriceAzn: number;
  discountedPriceAzn: number;
};

export type PublicTierStorefrontRow = {
  id: TariffTier;
  spendCeilingAzn: number;
};

export type PublicIndustryGroupRow = {
  satelliteKey: string;
  gate: { key: string; name: string; pricePerMonth: number } | null;
  modules: Array<{
    key: string;
    name: string;
    pricePerMonth: number;
    isPremium: boolean;
  }>;
  bundles: PublicBundleStorefrontRow[];
  capacity: { includedInGate: number; unitAzn: number; unit: string } | null;
  note: "banking_sandbox" | null;
};

export type PublicPlatformAddonRow = {
  key: string;
  name: string;
  pricePerMonth: number;
};

const TIER_ORDER: TariffTier[] = [
  TariffTier.TIER_0,
  TariffTier.TIER_1,
  TariffTier.TIER_2,
  TariffTier.TIER_3,
];

function modulePriceSum(
  keys: readonly string[],
  byKey: Map<string, PublicPricingModuleRow>,
): number {
  let sum = 0;
  for (const k of keys) {
    sum += byKey.get(k)?.pricePerMonth ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

function bundleMarketingId(moduleKeys: string[]): string {
  const sorted = [...moduleKeys].sort().join(",");
  const hit = ALL_BUNDLE_MARKETING.find(
    (m) => [...m.matchModuleKeys].sort().join(",") === sorted,
  );
  if (hit) return hit.marketingId;
  return `bundle_${sorted.replace(/,/g, "_")}`;
}

function resolveIndustryGroup(m: PublicPricingModuleRow): string | null {
  if (m.key.startsWith("industry_")) return m.key;
  if (m.satelliteKey?.startsWith("industry_")) return m.satelliteKey;
  const inferred = inferSatelliteKeyFromModuleKey(m.key);
  if (inferred?.startsWith("industry_")) return inferred;
  return null;
}

function isFinancePremium(m: PublicPricingModuleRow): boolean {
  if (!m.isPremium) return false;
  if (resolveIndustryGroup(m)) return false;
  if (m.key.startsWith("platform_")) return false;
  return true;
}

export function enrichPublicPricingStorefront(input: {
  foundationMonthlyAzn: number;
  pricingModules: PublicPricingModuleRow[];
  pricingBundles: PublicPricingBundleRow[];
  tierSpendCeilingsAzn: Record<string, number>;
  meterUnitPricing: MeterUnitPricing;
  quotaUnitPricing?: QuotaUnitPricing;
}) {
  const byKey = new Map(input.pricingModules.map((m) => [m.key, m]));

  const standardModules: PublicStandardModuleRow[] =
    PRICING_STANDARD_MODULE_REGISTRY.map((reg) => ({
      id: reg.id,
      moduleKeys: [...reg.moduleKeys],
      pricePerMonthAzn: reg.usesFoundation
        ? input.foundationMonthlyAzn
        : modulePriceSum(reg.moduleKeys, byKey),
    }));

  const premiumModules = input.pricingModules
    .filter(isFinancePremium)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      key: row.key,
      name: row.name,
      pricePerMonth: row.pricePerMonth,
      sortOrder: row.sortOrder,
    }));

  const allBundles: PublicBundleStorefrontRow[] = input.pricingBundles
    .filter((b) => !b.isTrialDefault && b.discountPercent < 100)
    .map((b) => {
      const listPriceAzn = modulePriceSum(b.moduleKeys, byKey);
      const discountedPriceAzn =
        Math.round(listPriceAzn * (1 - b.discountPercent / 100) * 100) / 100;
      return {
        ...b,
        marketingId: bundleMarketingId(b.moduleKeys),
        listPriceAzn,
        discountedPriceAzn,
      };
    })
    .filter((b) => b.discountedPriceAzn > 0)
    .sort((a, b) => b.discountedPriceAzn - a.discountedPriceAzn);

  const bundles = allBundles.filter((b) => bundleIndustrySatelliteKey(b.moduleKeys) == null);
  const hospitalityBundles = allBundles.filter(
    (b) => bundleIndustrySatelliteKey(b.moduleKeys) === "industry_hotel_pms",
  );

  const hospitalityModules = input.pricingModules
    .filter((m) => m.key === "industry_hotel_pms" || m.key.startsWith("hotel_"))
    .filter((m) => m.key === "industry_hotel_pms" || m.pricePerMonth > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      key: row.key,
      name: row.name,
      pricePerMonth: row.pricePerMonth,
      sortOrder: row.sortOrder,
      isPremium: row.isPremium,
    }));

  const capacityBySatellite = new Map(
    CAPACITY_DRIVERS.map((d) => [d.satelliteKey, d] as const),
  );

  const industryGroups: PublicIndustryGroupRow[] = INDUSTRY_STOREFRONT_GROUP_ORDER.map(
    (satelliteKey) => {
      const members = input.pricingModules.filter(
        (m) => resolveIndustryGroup(m) === satelliteKey,
      );
      const gateRow = members.find((m) => m.key === satelliteKey) ?? null;
      const modules = members
        .filter((m) => m.key !== satelliteKey && m.pricePerMonth > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          key: row.key,
          name: row.name,
          pricePerMonth: row.pricePerMonth,
          isPremium: row.isPremium,
        }));
      const groupBundles = allBundles.filter(
        (b) => bundleIndustrySatelliteKey(b.moduleKeys) === satelliteKey,
      );
      const cap = capacityBySatellite.get(satelliteKey) ?? null;
      return {
        satelliteKey,
        gate: gateRow
          ? {
              key: gateRow.key,
              name: gateRow.name,
              pricePerMonth: gateRow.pricePerMonth,
            }
          : null,
        modules,
        bundles: groupBundles,
        capacity: cap
          ? {
              includedInGate: cap.includedInGate,
              unitAzn: cap.unitAzn,
              unit: cap.unit,
            }
          : null,
        note: satelliteKey === "industry_banking" ? ("banking_sandbox" as const) : null,
      };
    },
  ).filter((g) => g.gate || g.modules.length > 0 || g.bundles.length > 0);

  const platformAddons: PublicPlatformAddonRow[] = input.pricingModules
    .filter(
      (m) =>
        m.key.startsWith("platform_") &&
        m.pricePerMonth > 0 &&
        !isWorkforcePlatformKey(m.key),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      key: row.key,
      name: row.name,
      pricePerMonth: row.pricePerMonth,
    }));

  const tiers: PublicTierStorefrontRow[] = TIER_ORDER.map((id) => ({
    id,
    spendCeilingAzn: Number(input.tierSpendCeilingsAzn[id] ?? 0),
  }));

  return {
    standardModules,
    premiumModules,
    bundles,
    hospitalityBundles,
    hospitalityModules,
    industryGroups,
    platformAddons,
    capacityDrivers: CAPACITY_DRIVERS.map((d) => ({
      satelliteKey: d.satelliteKey,
      includedInGate: d.includedInGate,
      unitAzn: d.unitAzn,
      unit: d.unit,
    })),
    quotaUnitPricing: input.quotaUnitPricing ?? null,
    tiers,
    meterUnitPricing: input.meterUnitPricing,
  };
}
