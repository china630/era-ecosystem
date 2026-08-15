import type { PrismaClient } from "../../../generated/client";
import { Prisma } from "../../../generated/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "./pricing-module-keys";
import { BANKING_PRICING_MODULE_KEYS } from "./hotel-module-keys";

export type PricingBundleSeedRow = {
  name: string;
  discountPercent: number;
  moduleKeys: readonly string[];
  /** Commercial slug when set (e.g. banking_bundle_universal). */
  slug?: string;
};

/** Retail banking pack — no treasury/regreporting/risk by default (ADR R6). */
const BANKING_BUNDLE_RETAIL_KEYS = [
  "banking_core",
  "banking_deposits",
  "banking_loans",
  "banking_cards",
  "banking_payments",
  "banking_dbo",
  "banking_aml",
] as const;

export const PRICING_BUNDLE_SEED_DEFAULTS: ReadonlyArray<PricingBundleSeedRow> = [
  {
    name: "Cash & warehouse",
    discountPercent: 15,
    moduleKeys: [PRICING_MODULE_CASH_BANK_PRO, "inventory"],
  },
  {
    name: "HR & IFRS",
    discountPercent: 10,
    moduleKeys: ["hr_full", "ifrs_mapping"],
  },
  {
    name: "Trade & operations",
    discountPercent: 20,
    moduleKeys: ["inventory", "manufacturing"],
  },
  {
    name: "Hotel City",
    discountPercent: 10,
    moduleKeys: ["hotel_core", "hotel_housekeeping", "hotel_migration_pro"],
  },
  {
    name: "Hotel Resort",
    discountPercent: 15,
    moduleKeys: [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_migration_pro",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
    ],
  },
  {
    name: "Hotel Sanatorium",
    discountPercent: 12,
    moduleKeys: [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_migration_pro",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
      "hotel_medical_sanatorium",
    ],
  },
  {
    name: "Banking Retail",
    slug: "banking_bundle_retail",
    discountPercent: 12,
    moduleKeys: BANKING_BUNDLE_RETAIL_KEYS,
  },
  {
    name: "Banking Universal",
    slug: "banking_bundle_universal",
    discountPercent: 15,
    moduleKeys: BANKING_PRICING_MODULE_KEYS,
  },
];

function bundleCreateData(b: PricingBundleSeedRow) {
  return {
    name: b.name,
    slug: b.slug ?? null,
    discountPercent: new Prisma.Decimal(b.discountPercent),
    moduleKeys: [...b.moduleKeys],
    isTrialDefault: false,
  };
}

export async function seedPricingBundleDefaultsIfEmpty(
  prisma: PrismaClient,
): Promise<void> {
  const n = await prisma.pricingBundle.count();
  if (n === 0) {
    for (const b of PRICING_BUNDLE_SEED_DEFAULTS) {
      await prisma.pricingBundle.create({
        data: bundleCreateData(b),
      });
    }
    return;
  }
  await ensureMissingPricingBundles(prisma);
}

export async function ensureMissingPricingBundles(prisma: PrismaClient): Promise<void> {
  for (const b of PRICING_BUNDLE_SEED_DEFAULTS) {
    const existing = b.slug
      ? await prisma.pricingBundle.findFirst({
          where: { OR: [{ slug: b.slug }, { name: b.name }] },
        })
      : await prisma.pricingBundle.findFirst({
          where: { name: b.name },
        });
    if (existing) {
      await prisma.pricingBundle.update({
        where: { id: existing.id },
        data: {
          moduleKeys: [...b.moduleKeys],
          ...(b.slug ? { slug: b.slug } : {}),
        },
      });
      continue;
    }
    await prisma.pricingBundle.create({
      data: bundleCreateData(b),
    });
  }
}
