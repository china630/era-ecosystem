import type { PrismaClient } from "../../../generated/client";
import { Prisma } from "../../../generated/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "./pricing-module-keys";

export type PricingBundleSeedRow = {
  name: string;
  discountPercent: number;
  moduleKeys: readonly string[];
};

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
    moduleKeys: ["hotel_core", "hotel_housekeeping"],
  },
  {
    name: "Hotel Resort",
    discountPercent: 15,
    moduleKeys: [
      "hotel_core",
      "hotel_housekeeping",
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
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
      "hotel_medical_sanatorium",
    ],
  },
];

export async function seedPricingBundleDefaultsIfEmpty(
  prisma: PrismaClient,
): Promise<void> {
  const n = await prisma.pricingBundle.count();
  if (n === 0) {
    for (const b of PRICING_BUNDLE_SEED_DEFAULTS) {
      await prisma.pricingBundle.create({
        data: {
          name: b.name,
          discountPercent: new Prisma.Decimal(b.discountPercent),
          moduleKeys: [...b.moduleKeys],
          isTrialDefault: false,
        },
      });
    }
    return;
  }
  await ensureMissingPricingBundles(prisma);
}

export async function ensureMissingPricingBundles(prisma: PrismaClient): Promise<void> {
  for (const b of PRICING_BUNDLE_SEED_DEFAULTS) {
    const existing = await prisma.pricingBundle.findFirst({
      where: { name: b.name },
    });
    if (existing) {
      await prisma.pricingBundle.update({
        where: { id: existing.id },
        data: { moduleKeys: [...b.moduleKeys] },
      });
      continue;
    }
    await prisma.pricingBundle.create({
      data: {
        name: b.name,
        discountPercent: new Prisma.Decimal(b.discountPercent),
        moduleKeys: [...b.moduleKeys],
        isTrialDefault: false,
      },
    });
  }
}
