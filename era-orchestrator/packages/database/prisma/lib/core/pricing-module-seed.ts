import type { PrismaClient } from "../../../generated/client";
import { Prisma } from "../../../generated/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "./pricing-module-keys";
import { inferPricingCatalogKind, INDUSTRY_SATELLITE_MODULE_KEYS } from "./hotel-module-keys";

export type PricingModuleSeedRow = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  isPremium?: boolean;
  satelliteKey?: string | null;
  trialEligibleInTrial?: boolean;
};

const FINANCE_TRIAL_ELIGIBLE = new Set([
  "nas",
  "ifrs_mapping",
  "manufacturing",
  "fixed_assets",
  "inventory",
  "hr_full",
  "audit_hub",
  PRICING_MODULE_CASH_BANK_PRO,
]);

const INDUSTRY_TRIAL_ELIGIBLE = new Set(INDUSTRY_SATELLITE_MODULE_KEYS);

const INDUSTRY_SATELLITE_SEED: ReadonlyArray<{
  key: (typeof INDUSTRY_SATELLITE_MODULE_KEYS)[number];
  name: string;
  sortOrder: number;
  pricePerMonth: number;
}> = [
  { key: "industry_hotel_pms", name: "Hotel PMS", sortOrder: 100, pricePerMonth: 28 },
  { key: "industry_fnb_pos", name: "F&B POS", sortOrder: 101, pricePerMonth: 22 },
  { key: "industry_retail", name: "Retail POS", sortOrder: 102, pricePerMonth: 20 },
  { key: "industry_logistics", name: "Logistics", sortOrder: 103, pricePerMonth: 20 },
  { key: "industry_construction", name: "Construction", sortOrder: 104, pricePerMonth: 20 },
  { key: "industry_crm", name: "CRM Field", sortOrder: 105, pricePerMonth: 18 },
  { key: "industry_auto_service", name: "Auto STO", sortOrder: 106, pricePerMonth: 18 },
  { key: "industry_clinic", name: "Clinic", sortOrder: 107, pricePerMonth: 22 },
  { key: "industry_wholesale", name: "Wholesale", sortOrder: 108, pricePerMonth: 18 },
  { key: "industry_banking", name: "Bank CBS", sortOrder: 109, pricePerMonth: 99 },
];

/**
 * Canonical defaults for `pricing_modules` — synced with Super-Admin catalog (2026-05).
 */
export const PRICING_MODULE_SEED_DEFAULTS: ReadonlyArray<PricingModuleSeedRow> = [
  {
    key: PRICING_MODULE_CASH_BANK_PRO,
    name: "Cash & Bank Pro",
    pricePerMonth: 38,
    sortOrder: 0,
    isPremium: false,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  {
    key: "nas",
    name: "General Ledger (NAS)",
    pricePerMonth: 0,
    sortOrder: 0,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  {
    key: "inventory",
    name: "Warehouse",
    pricePerMonth: 19,
    sortOrder: 1,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  {
    key: "manufacturing",
    name: "Manufacturing",
    pricePerMonth: 19,
    sortOrder: 2,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  {
    key: "hr_full",
    name: "HR & Payroll",
    pricePerMonth: 19,
    sortOrder: 3,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  {
    key: "platform_workforce",
    name: "Workforce Hub (CP)",
    pricePerMonth: 0,
    sortOrder: 3,
    trialEligibleInTrial: true,
  },
  {
    key: "ifrs_mapping",
    name: "IFRS",
    pricePerMonth: 19,
    sortOrder: 4,
    satelliteKey: "finance_core",
    trialEligibleInTrial: true,
  },
  { key: "tax_pro", name: "Tax Pro", pricePerMonth: 19, sortOrder: 10, isPremium: true },
  { key: "trade_pro", name: "Trade Pro", pricePerMonth: 19, sortOrder: 11, isPremium: true },
  { key: "audit_hub", name: "Audit Hub", pricePerMonth: 99, sortOrder: 12, isPremium: true },
  {
    key: "compliance_pro",
    name: "Risk & Compliance (ERM)",
    pricePerMonth: 99,
    sortOrder: 13,
    isPremium: true,
  },
  {
    key: "contract_management_pro",
    name: "Contract Management",
    pricePerMonth: 29,
    sortOrder: 14,
    isPremium: true,
  },
  {
    key: "gov_budget_pro",
    name: "Gov Budget (B2G)",
    pricePerMonth: 49,
    sortOrder: 15,
    isPremium: true,
  },
  {
    key: "platform_notifications",
    name: "Notifications Pack",
    pricePerMonth: 19,
    sortOrder: 20,
    isPremium: false,
  },
  {
    key: "platform_notifications_sms",
    name: "Notifications Pack — SMS",
    pricePerMonth: 9,
    sortOrder: 21,
    isPremium: true,
  },
  {
    key: "platform_storage",
    name: "Cloud Storage (S3)",
    pricePerMonth: 15,
    sortOrder: 22,
    isPremium: false,
  },
  {
    key: "platform_reference_data",
    name: "ERA Data Hub (Reference Data API)",
    pricePerMonth: 29,
    sortOrder: 23,
    isPremium: false,
  },
  ...INDUSTRY_SATELLITE_SEED.map((s) => ({
    key: s.key,
    name: s.name,
    pricePerMonth: s.pricePerMonth,
    sortOrder: s.sortOrder,
    isPremium: false,
    satelliteKey: null as string | null,
    trialEligibleInTrial: true,
  })),
  // Hotel PMS submodules (9-key taxonomy)
  {
    key: "hotel_core",
    name: "PMS Core (Front Office, Front Cash, Night Audit)",
    pricePerMonth: 24,
    sortOrder: 110,
    isPremium: false,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_housekeeping",
    name: "Housekeeping & Room Rack",
    pricePerMonth: 8,
    sortOrder: 111,
    isPremium: false,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_service",
    name: "Service & maintenance",
    pricePerMonth: 10,
    sortOrder: 1115,
    isPremium: false,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_migration_pro",
    name: "Migration PRO (guest registration to migration service)",
    pricePerMonth: 12,
    sortOrder: 1116,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_distribution",
    name: "Distribution (Channel Manager & Contracts)",
    pricePerMonth: 27,
    sortOrder: 112,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_guest_experience",
    name: "Guest Profiles & Tasks",
    pricePerMonth: 10,
    sortOrder: 113,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_spa_scheduling",
    name: "SPA & Procedures",
    pricePerMonth: 10,
    sortOrder: 114,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_transfers",
    name: "Transfers",
    pricePerMonth: 6,
    sortOrder: 115,
    isPremium: false,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_banquets",
    name: "Banquets & BEO",
    pricePerMonth: 10,
    sortOrder: 116,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_medical_sanatorium",
    name: "Medical & Sanatorium",
    pricePerMonth: 14,
    sortOrder: 117,
    isPremium: true,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "hotel_setup_advanced",
    name: "Advanced master data",
    pricePerMonth: 5,
    sortOrder: 118,
    isPremium: false,
    satelliteKey: "industry_hotel_pms",
  },
  {
    key: "banking_core",
    name: "Bank Core (kernel)",
    pricePerMonth: 0,
    sortOrder: 120,
    isPremium: false,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_payments",
    name: "Payments hub",
    pricePerMonth: 29,
    sortOrder: 121,
    isPremium: false,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_deposits",
    name: "Deposits",
    pricePerMonth: 19,
    sortOrder: 122,
    isPremium: false,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_loans",
    name: "Lending",
    pricePerMonth: 29,
    sortOrder: 123,
    isPremium: false,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_aml",
    name: "AML / Compliance",
    pricePerMonth: 39,
    sortOrder: 124,
    isPremium: true,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_regreporting",
    name: "Regulatory reporting",
    pricePerMonth: 29,
    sortOrder: 125,
    isPremium: true,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_dbo",
    name: "Digital banking (DBO)",
    pricePerMonth: 19,
    sortOrder: 126,
    isPremium: false,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_cards",
    name: "Cards",
    pricePerMonth: 29,
    sortOrder: 127,
    isPremium: true,
    satelliteKey: "industry_banking",
  },
  {
    key: "banking_treasury",
    name: "Treasury / ALM",
    pricePerMonth: 39,
    sortOrder: 128,
    isPremium: true,
    satelliteKey: "industry_banking",
  },
];

async function ensureSatellites(prisma: PrismaClient): Promise<void> {
  await prisma.satellite.upsert({
    where: { key: "finance_core" },
    create: {
      key: "finance_core",
      name: "Finance Core",
      verticalSlug: "finance",
      sortOrder: 50,
    },
    update: { name: "Finance Core" },
  });

  const verticalByKey: Record<string, string> = {
    industry_hotel_pms: "hotel",
    industry_fnb_pos: "fnb",
    industry_retail: "retail",
    industry_logistics: "logistics",
    industry_construction: "construction",
    industry_crm: "crm",
    industry_auto_service: "auto",
    industry_clinic: "clinic",
    industry_wholesale: "wholesale",
    industry_banking: "banking",
  };
  for (const s of INDUSTRY_SATELLITE_SEED) {
    await prisma.satellite.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        name: s.name,
        verticalSlug: verticalByKey[s.key] ?? s.key.replace("industry_", ""),
        sortOrder: s.sortOrder,
      },
      update: { name: s.name },
    });
  }
}

function moduleSeedData(m: PricingModuleSeedRow) {
  const catalogKind = inferPricingCatalogKind(m.key);
  let satelliteKey =
    m.satelliteKey ??
    (m.key.startsWith("hotel_")
      ? "industry_hotel_pms"
      : m.key.startsWith("banking_")
        ? "industry_banking"
        : null);
  if (!satelliteKey && FINANCE_TRIAL_ELIGIBLE.has(m.key)) {
    satelliteKey = "finance_core";
  }
  let trialEligibleInTrial = m.trialEligibleInTrial ?? false;
  if (!trialEligibleInTrial) {
    if (FINANCE_TRIAL_ELIGIBLE.has(m.key)) trialEligibleInTrial = true;
    if (INDUSTRY_TRIAL_ELIGIBLE.has(m.key as (typeof INDUSTRY_SATELLITE_MODULE_KEYS)[number])) {
      trialEligibleInTrial = true;
    }
    if (m.key === "hotel_core") trialEligibleInTrial = true;
  }
  return {
    key: m.key,
    name: m.name,
    pricePerMonth: new Prisma.Decimal(m.pricePerMonth),
    sortOrder: m.sortOrder,
    isPremium: m.isPremium ?? false,
    catalogKind,
    satelliteKey,
    trialEligibleInTrial,
  };
}

export async function seedPricingModuleIfEmpty(prisma: PrismaClient): Promise<void> {
  await ensureSatellites(prisma);
  const n = await prisma.pricingModule.count();
  if (n === 0) {
    for (const m of PRICING_MODULE_SEED_DEFAULTS) {
      await prisma.pricingModule.create({ data: moduleSeedData(m) });
    }
    return;
  }
  await ensureMissingPricingModules(prisma);
}

export async function ensureMissingPricingModules(prisma: PrismaClient): Promise<void> {
  await ensureSatellites(prisma);
  for (const m of PRICING_MODULE_SEED_DEFAULTS) {
    const existing = await prisma.pricingModule.findUnique({
      where: { key: m.key },
      select: { id: true },
    });
    if (existing) continue;
    try {
      await prisma.pricingModule.create({ data: moduleSeedData(m) });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
}
