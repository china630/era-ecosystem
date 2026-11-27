import type { PrismaClient } from "../../../generated/client";

type LocaleMap = { az?: string; ru?: string; en?: string };

type SatelliteProfileSeed = {
  satelliteKey: string;
  publicSlug: string;
  kind: "core" | "industry" | "platform";
  maturity: "prod" | "pilot";
  sortOrder: number;
  names: LocaleMap;
  descriptions?: LocaleMap;
  visibility?: "VISIBLE" | "HIDDEN" | "DRAFT";
};

type ModuleProfileSeed = {
  moduleKey: string;
  maturity?: "prod" | "pilot";
  sortOrder?: number;
  names?: LocaleMap;
  visibility?: "VISIBLE" | "HIDDEN" | "DRAFT";
};

type IndustryItemSeed = {
  satelliteKey: string;
  moduleKey?: string;
  role: "C" | "I" | "O";
  assumed?: boolean;
  sortOrder: number;
};

type IndustrySeed = {
  slug: string;
  sortOrder: number;
  maturityOverride?: "prod" | "pilot";
  names: LocaleMap;
  descriptions?: LocaleMap;
  calcPrefill?: { moduleKeys: string[]; capacity?: Record<string, unknown> };
  items: IndustryItemSeed[];
};

/** Site-facing satellite rows that must exist but stay out of INDUSTRY_SATELLITE_KEYS / Connect. */
export const PLATFORM_SITE_SATELLITES: ReadonlyArray<{
  key: string;
  name: string;
  verticalSlug: string;
  sortOrder: number;
}> = [
  {
    key: "platform_workforce",
    name: "Workforce",
    verticalSlug: "workforce",
    sortOrder: 200,
  },
  {
    key: "platform_datahub",
    name: "Data HUB",
    verticalSlug: "data-hub",
    sortOrder: 201,
  },
];

const SATELLITE_PROFILES: ReadonlyArray<SatelliteProfileSeed> = [
  {
    satelliteKey: "finance_core",
    publicSlug: "finance",
    kind: "core",
    maturity: "prod",
    sortOrder: 10,
    names: { az: "ERA Core", ru: "ERA Core", en: "ERA Core" },
    descriptions: {
      az: "Mühasibat, anbar, kadr və vergi — bir platforma.",
      ru: "Учёт, склад, кадры и налоги — одна платформа.",
      en: "Accounting, warehouse, HR and tax — one platform.",
    },
  },
  {
    satelliteKey: "industry_hotel_pms",
    publicSlug: "hotel",
    kind: "industry",
    maturity: "prod",
    sortOrder: 20,
    names: { az: "Hotel PMS", ru: "Hotel PMS", en: "Hotel PMS" },
  },
  {
    satelliteKey: "industry_fnb_pos",
    publicSlug: "fnb",
    kind: "industry",
    maturity: "prod",
    sortOrder: 30,
    names: { az: "F&B POS", ru: "F&B POS", en: "F&B POS" },
  },
  {
    satelliteKey: "industry_auto_service",
    publicSlug: "auto",
    kind: "industry",
    maturity: "prod",
    sortOrder: 40,
    names: { az: "Auto Service", ru: "Auto Service", en: "Auto Service" },
  },
  {
    satelliteKey: "industry_logistics",
    publicSlug: "logistics",
    kind: "industry",
    maturity: "prod",
    sortOrder: 50,
    names: { az: "Logistics", ru: "Logistics", en: "Logistics" },
  },
  {
    satelliteKey: "industry_wholesale",
    publicSlug: "wholesale",
    kind: "industry",
    maturity: "prod",
    sortOrder: 60,
    names: { az: "Wholesale", ru: "Wholesale", en: "Wholesale" },
  },
  {
    satelliteKey: "industry_crm",
    publicSlug: "crm",
    kind: "industry",
    maturity: "prod",
    sortOrder: 70,
    names: { az: "CRM", ru: "CRM", en: "CRM" },
  },
  {
    satelliteKey: "platform_workforce",
    publicSlug: "workforce",
    kind: "platform",
    maturity: "prod",
    sortOrder: 80,
    names: { az: "Workforce", ru: "Workforce", en: "Workforce" },
  },
  {
    satelliteKey: "industry_clinic",
    publicSlug: "clinic",
    kind: "industry",
    maturity: "pilot",
    sortOrder: 90,
    names: { az: "Clinic", ru: "Clinic", en: "Clinic" },
  },
  {
    satelliteKey: "industry_retail",
    publicSlug: "retail",
    kind: "industry",
    maturity: "pilot",
    sortOrder: 100,
    names: { az: "Retail POS", ru: "Retail POS", en: "Retail POS" },
  },
  {
    satelliteKey: "industry_construction",
    publicSlug: "construction",
    kind: "industry",
    maturity: "pilot",
    sortOrder: 110,
    names: { az: "Construction", ru: "Construction", en: "Construction" },
  },
  {
    satelliteKey: "industry_banking",
    publicSlug: "banking",
    kind: "industry",
    maturity: "pilot",
    sortOrder: 120,
    names: { az: "Bank CBS", ru: "Bank CBS", en: "Bank CBS" },
  },
  {
    satelliteKey: "platform_datahub",
    publicSlug: "data-hub",
    kind: "platform",
    maturity: "pilot",
    sortOrder: 130,
    names: { az: "Data HUB", ru: "Data HUB", en: "Data HUB" },
  },
];

const MODULE_PILOT_KEYS = [
  "clinic_sanatorium",
  "clinic_inpatient",
  "clinic_telehealth",
  "hotel_medical_sanatorium",
  "banking_dbo",
  "banking_loans",
  "banking_collections",
] as const;

const INDUSTRIES: ReadonlyArray<IndustrySeed> = [
  {
    slug: "hotels",
    sortOrder: 10,
    maturityOverride: "prod",
    names: { az: "Otellər", ru: "Отели", en: "Hotels" },
    calcPrefill: { moduleKeys: ["industry_hotel_pms"] },
    items: [
      { satelliteKey: "industry_hotel_pms", role: "C", sortOrder: 1 },
      { satelliteKey: "industry_fnb_pos", role: "I", sortOrder: 2 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 3 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 4 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 5 },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
  {
    slug: "sanatoriums",
    sortOrder: 20,
    names: { az: "Sanatoriyalar", ru: "Санатории", en: "Sanatoriums" },
    calcPrefill: {
      moduleKeys: ["industry_hotel_pms", "hotel_medical_sanatorium", "clinic_sanatorium"],
    },
    items: [
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_medical_sanatorium",
        role: "C",
        sortOrder: 1,
      },
      { satelliteKey: "industry_clinic", role: "C", sortOrder: 2 },
      { satelliteKey: "industry_fnb_pos", role: "I", sortOrder: 3 },
      { satelliteKey: "industry_retail", role: "I", sortOrder: 4 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 5 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 6 },
      { satelliteKey: "industry_crm", role: "O", sortOrder: 7 },
    ],
  },
  {
    slug: "clinics",
    sortOrder: 30,
    names: { az: "Klinikalar", ru: "Клиники", en: "Clinics" },
    calcPrefill: { moduleKeys: ["industry_clinic", "clinic_registry_emr"] },
    items: [
      { satelliteKey: "industry_clinic", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 3 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 4 },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 5,
      },
    ],
  },
  {
    slug: "hospitals",
    sortOrder: 40,
    names: { az: "Xəstəxanalar", ru: "Больницы", en: "Hospitals" },
    calcPrefill: {
      moduleKeys: ["industry_clinic", "clinic_inpatient", "clinic_nurse_roster"],
    },
    items: [
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_inpatient",
        role: "C",
        sortOrder: 1,
      },
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_nurse_roster",
        role: "C",
        sortOrder: 2,
      },
      { satelliteKey: "finance_core", role: "I", sortOrder: 3 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 4 },
      {
        satelliteKey: "industry_fnb_pos",
        role: "I",
        assumed: true,
        sortOrder: 5,
      },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
      { satelliteKey: "industry_crm", role: "O", sortOrder: 7 },
    ],
  },
  {
    slug: "restaurants",
    sortOrder: 50,
    maturityOverride: "prod",
    names: {
      az: "Restoranlar və kafələr",
      ru: "Рестораны и кафе",
      en: "Restaurants and cafes",
    },
    calcPrefill: { moduleKeys: ["industry_fnb_pos"] },
    items: [
      { satelliteKey: "industry_fnb_pos", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 3 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 4 },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 5,
      },
    ],
  },
  {
    slug: "banks",
    sortOrder: 60,
    names: { az: "Banklar", ru: "Банки", en: "Banks" },
    calcPrefill: { moduleKeys: ["industry_banking", "banking_dbo"] },
    items: [
      { satelliteKey: "industry_banking", role: "C", sortOrder: 1 },
      {
        satelliteKey: "industry_banking",
        moduleKey: "banking_dbo",
        role: "C",
        sortOrder: 2,
      },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 3 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 4 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 5 },
      {
        satelliteKey: "platform_datahub",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
  {
    slug: "leasing-nbco",
    sortOrder: 70,
    names: {
      az: "Lizinq və BOKT",
      ru: "Лизинг и НБКО",
      en: "Leasing and NBCO",
    },
    calcPrefill: {
      moduleKeys: ["industry_banking", "banking_loans", "banking_collections", "banking_dbo"],
    },
    items: [
      {
        satelliteKey: "industry_banking",
        moduleKey: "banking_loans",
        role: "C",
        sortOrder: 1,
      },
      {
        satelliteKey: "industry_banking",
        moduleKey: "banking_collections",
        role: "C",
        sortOrder: 2,
      },
      {
        satelliteKey: "industry_banking",
        moduleKey: "banking_dbo",
        role: "I",
        sortOrder: 3,
      },
      { satelliteKey: "finance_core", role: "I", sortOrder: 4 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 5 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 6 },
      { satelliteKey: "platform_datahub", role: "O", sortOrder: 7 },
    ],
  },
  {
    slug: "retail",
    sortOrder: 80,
    names: { az: "Pərakəndə", ru: "Розница", en: "Retail" },
    calcPrefill: { moduleKeys: ["industry_retail"] },
    items: [
      { satelliteKey: "industry_retail", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 3 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 4 },
      { satelliteKey: "industry_wholesale", role: "O", sortOrder: 5 },
      {
        satelliteKey: "platform_datahub",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
  {
    slug: "wholesale",
    sortOrder: 90,
    maturityOverride: "prod",
    names: { az: "Topdan satış", ru: "Опт", en: "Wholesale" },
    calcPrefill: { moduleKeys: ["industry_wholesale"] },
    items: [
      { satelliteKey: "industry_wholesale", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "industry_logistics", role: "I", sortOrder: 3 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 4 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 5 },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
  {
    slug: "auto-service",
    sortOrder: 100,
    maturityOverride: "prod",
    names: { az: "Avtoservis", ru: "Автосервис", en: "Auto service" },
    calcPrefill: { moduleKeys: ["industry_auto_service"] },
    items: [
      { satelliteKey: "industry_auto_service", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 3 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 4 },
      {
        satelliteKey: "industry_retail",
        role: "O",
        assumed: true,
        sortOrder: 5,
      },
    ],
  },
  {
    slug: "logistics",
    sortOrder: 110,
    maturityOverride: "prod",
    names: { az: "Logistika", ru: "Логистика", en: "Logistics" },
    calcPrefill: { moduleKeys: ["industry_logistics"] },
    items: [
      { satelliteKey: "industry_logistics", role: "C", sortOrder: 1 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 2 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 3 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 4 },
      { satelliteKey: "industry_wholesale", role: "O", sortOrder: 5 },
      {
        satelliteKey: "industry_auto_service",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
  {
    slug: "construction",
    sortOrder: 120,
    names: { az: "Tikinti", ru: "Строительство", en: "Construction" },
    calcPrefill: { moduleKeys: ["industry_construction", "construction_boq"] },
    items: [
      { satelliteKey: "industry_construction", role: "C", sortOrder: 1 },
      { satelliteKey: "industry_crm", role: "I", sortOrder: 2 },
      { satelliteKey: "finance_core", role: "I", sortOrder: 3 },
      { satelliteKey: "platform_workforce", role: "I", sortOrder: 4 },
      {
        satelliteKey: "industry_logistics",
        role: "I",
        assumed: true,
        sortOrder: 5,
      },
      {
        satelliteKey: "industry_wholesale",
        role: "O",
        assumed: true,
        sortOrder: 6,
      },
    ],
  },
];

/** Default system_config keys for the public site (idempotent upsert-if-missing). */
export const SITE_SYSTEM_CONFIG_DEFAULTS: ReadonlyArray<{
  key: string;
  value: unknown;
}> = [
  { key: "site.origin", value: "https://era-365.online" },
  { key: "site.app_origin", value: "https://app.era-365.online" },
  { key: "site.crm_origin", value: "https://crm.era-365.online" },
  { key: "site.crm_internal_url", value: "http://crm:3207" },
  { key: "site.demo_form_public_id", value: "" },
  { key: "site.demo_form_webhook_secret", value: "" },
  { key: "site.crm_organization_id", value: "" },
  { key: "site.contact_phone", value: "+994 77 350 70 70" },
  { key: "site.contact_phone_e164", value: "+994773507070" },
  { key: "site.contact_email", value: "chingiz@era-365.online" },
  { key: "site.contact_address", value: "" },
  { key: "site.legal_name", value: "" },
  { key: "site.voen", value: "" },
  { key: "site.trust_blocks_enabled", value: false },
  { key: "site.catalog_cache_version", value: 0 },
];

export async function ensurePlatformSiteSatellites(
  prisma: PrismaClient,
): Promise<void> {
  for (const s of PLATFORM_SITE_SATELLITES) {
    await prisma.satellite.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        name: s.name,
        verticalSlug: s.verticalSlug,
        sortOrder: s.sortOrder,
      },
      update: {
        name: s.name,
        verticalSlug: s.verticalSlug,
        sortOrder: s.sortOrder,
      },
    });
  }
}

/**
 * Create empty VISIBLE public profile for a new commercial satellite if missing.
 * Does not overwrite human-edited texts.
 */
export async function ensureEmptySatellitePublicProfile(
  prisma: PrismaClient,
  opts: {
    satelliteKey: string;
    publicSlug: string;
    kind?: "core" | "industry" | "platform";
    maturity?: "prod" | "pilot";
    sortOrder?: number;
    visibility?: "VISIBLE" | "HIDDEN" | "DRAFT";
    names?: LocaleMap;
  },
): Promise<void> {
  const existing = await prisma.satellitePublicProfile.findUnique({
    where: { satelliteKey: opts.satelliteKey },
    select: { satelliteKey: true },
  });
  if (existing) return;
  await prisma.satellitePublicProfile.create({
    data: {
      satelliteKey: opts.satelliteKey,
      publicSlug: opts.publicSlug,
      kind: opts.kind ?? "industry",
      maturity: opts.maturity ?? "prod",
      sortOrder: opts.sortOrder ?? 999,
      visibility: opts.visibility ?? "VISIBLE",
      names: opts.names ?? {},
      descriptions: {},
      tagline: {},
      body: {},
      showOnSite: true,
    },
  });
}

export async function seedSatellitePublicProfiles(
  prisma: PrismaClient,
): Promise<void> {
  await ensurePlatformSiteSatellites(prisma);
  for (const p of SATELLITE_PROFILES) {
    const existing = await prisma.satellitePublicProfile.findUnique({
      where: { satelliteKey: p.satelliteKey },
    });
    if (existing) {
      // Keep human edits; only fill empty JSON locale maps / missing slug.
      const names = (existing.names ?? {}) as LocaleMap;
      const descriptions = (existing.descriptions ?? {}) as LocaleMap;
      const patch: Record<string, unknown> = {};
      if (!existing.publicSlug) patch.publicSlug = p.publicSlug;
      if (!names.az && !names.ru && !names.en) patch.names = p.names;
      if (
        p.descriptions &&
        !descriptions.az &&
        !descriptions.ru &&
        !descriptions.en
      ) {
        patch.descriptions = p.descriptions;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.satellitePublicProfile.update({
          where: { satelliteKey: p.satelliteKey },
          data: patch,
        });
      }
      continue;
    }
    await prisma.satellitePublicProfile.create({
      data: {
        satelliteKey: p.satelliteKey,
        publicSlug: p.publicSlug,
        kind: p.kind,
        maturity: p.maturity,
        sortOrder: p.sortOrder,
        visibility: p.visibility ?? "VISIBLE",
        names: p.names,
        descriptions: p.descriptions ?? {},
        tagline: {},
        body: {},
        showOnSite: true,
      },
    });
  }
}

export async function seedModulePublicProfiles(
  prisma: PrismaClient,
): Promise<void> {
  const modules = await prisma.pricingModule.findMany({
    select: { key: true, name: true, sortOrder: true, satelliteKey: true },
  });
  for (const m of modules) {
    const existing = await prisma.pricingModulePublicProfile.findUnique({
      where: { moduleKey: m.key },
      select: { moduleKey: true },
    });
    if (existing) continue;
    const pilot = (MODULE_PILOT_KEYS as readonly string[]).includes(m.key);
    await prisma.pricingModulePublicProfile.create({
      data: {
        moduleKey: m.key,
        visibility: "VISIBLE",
        maturity: pilot ? "pilot" : null,
        sortOrder: m.sortOrder,
        names: { az: m.name, ru: m.name, en: m.name },
        descriptions: {},
        tagline: {},
        body: {},
        showAsSubsection: true,
      },
    });
  }
  for (const key of MODULE_PILOT_KEYS) {
    await prisma.pricingModulePublicProfile.updateMany({
      where: { moduleKey: key, maturity: null },
      data: { maturity: "pilot" },
    });
  }
}

export async function seedSiteIndustries(prisma: PrismaClient): Promise<void> {
  for (const industry of INDUSTRIES) {
    const existing = await prisma.siteIndustry.findUnique({
      where: { slug: industry.slug },
    });
    if (!existing) {
      await prisma.siteIndustry.create({
        data: {
          slug: industry.slug,
          sortOrder: industry.sortOrder,
          maturityOverride: industry.maturityOverride ?? null,
          names: industry.names,
          descriptions: industry.descriptions ?? {},
          tagline: {},
          body: {},
          calcPrefill: industry.calcPrefill ?? undefined,
          visibility: "VISIBLE",
        },
      });
    } else if (!existing.calcPrefill && industry.calcPrefill) {
      await prisma.siteIndustry.update({
        where: { slug: industry.slug },
        data: { calcPrefill: industry.calcPrefill },
      });
    }

    for (const item of industry.items) {
      const moduleKey = item.moduleKey ?? "";
      const found = await prisma.siteIndustryItem.findFirst({
        where: {
          industrySlug: industry.slug,
          satelliteKey: item.satelliteKey,
          moduleKey,
        },
        select: { id: true },
      });
      if (found) continue;
      await prisma.siteIndustryItem.create({
        data: {
          industrySlug: industry.slug,
          satelliteKey: item.satelliteKey,
          moduleKey,
          role: item.role,
          assumed: item.assumed ?? false,
          sortOrder: item.sortOrder,
        },
      });
    }
  }
}

export async function seedSiteSystemConfigDefaults(
  prisma: PrismaClient,
): Promise<void> {
  for (const row of SITE_SYSTEM_CONFIG_DEFAULTS) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: row.key },
      select: { key: true },
    });
    if (existing) continue;
    await prisma.systemConfig.create({
      data: { key: row.key, value: row.value as object },
    });
  }
}

/** Full idempotent site catalog seed (call after satellites + pricing modules exist). */
export async function seedSiteCatalog(prisma: PrismaClient): Promise<void> {
  await ensurePlatformSiteSatellites(prisma);
  await seedSatellitePublicProfiles(prisma);
  await seedModulePublicProfiles(prisma);
  await seedSiteIndustries(prisma);
  await seedSiteSystemConfigDefaults(prisma);
}
