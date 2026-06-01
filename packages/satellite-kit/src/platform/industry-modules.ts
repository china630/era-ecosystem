/** Industry launcher config — shared by Orchestrator web (SP9). */

export type IndustryModuleKey =
  | "RETAIL"
  | "LOGISTICS"
  | "CONSTRUCTION"
  | "CRM"
  | "AUTO_SERVICE"
  | "CLINIC"
  | "WHOLESALE"
  | "HOTEL_PMS"
  | "FNB_POS";

/** @deprecated Use IndustryModuleKey */
export type LegacyIndustryModuleKey =
  | "RETAIL_ECOM"
  | "LOGISTICS_CUSTOMS"
  | "CRM_WHATSAPP"
  | "AUTO_STO"
  | "FB_POS";

export const INDUSTRY_MODULE_SLUGS = [
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_clinic",
  "industry_wholesale",
  "industry_hotel_pms",
  "industry_fnb_pos",
] as const;

/** Slugs accepted during one-release migration */
export const LEGACY_INDUSTRY_MODULE_SLUGS = [
  "industry_retail_ecom",
  "industry_logistics_customs",
  "industry_crm_whatsapp",
  "industry_auto_sto",
  "industry_fb_pos",
] as const;

export type IndustryModuleSlug = (typeof INDUSTRY_MODULE_SLUGS)[number];

export type SubscriptionModulesSnapshot = {
  activeModules: string[];
  modules: Record<string, boolean | undefined>;
};

export const INDUSTRY_NAV_ITEMS: Array<{
  key: IndustryModuleKey;
  slug: IndustryModuleSlug;
  href: string;
  vertical: string;
  satelliteUrlEnv: string;
  moduleField: string;
  title: string;
  description: string;
}> = [
  {
    key: "RETAIL",
    slug: "industry_retail",
    href: "/industry/retail",
    vertical: "retail",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_RETAIL_URL",
    moduleField: "industryRetail",
    title: "Retail & E-commerce",
    description: "POS, shifts, stock events",
  },
  {
    key: "LOGISTICS",
    slug: "industry_logistics",
    href: "/industry/logistics",
    vertical: "logistics",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_LOGISTICS_URL",
    moduleField: "industryLogistics",
    title: "Logistics & Customs",
    description: "Fleet, POD, customs",
  },
  {
    key: "CONSTRUCTION",
    slug: "industry_construction",
    href: "/industry/construction",
    vertical: "construction",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL",
    moduleField: "industryConstruction",
    title: "Construction",
    description: "Projects, plan vs actual",
  },
  {
    key: "CRM",
    slug: "industry_crm",
    href: "/industry/crm",
    vertical: "crm",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CRM_URL",
    moduleField: "industryCrm",
    title: "CRM & Communications",
    description: "Leads, visits, inbox",
  },
  {
    key: "AUTO_SERVICE",
    slug: "industry_auto_service",
    href: "/industry/auto-service",
    vertical: "auto-service",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_AUTO_URL",
    moduleField: "industryAutoService",
    title: "Auto Service",
    description: "Service bays, work orders",
  },
  {
    key: "CLINIC",
    slug: "industry_clinic",
    href: "/industry/clinic",
    vertical: "clinic",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CLINIC_URL",
    moduleField: "industryClinic",
    title: "Clinic",
    description: "Appointments, lab, sanatorium",
  },
  {
    key: "WHOLESALE",
    slug: "industry_wholesale",
    href: "/industry/wholesale",
    vertical: "wholesale",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_WHOLESALE_URL",
    moduleField: "industryWholesale",
    title: "Wholesale & Distribution",
    description: "Pick lists, B2B orders",
  },
  {
    key: "HOTEL_PMS",
    slug: "industry_hotel_pms",
    href: "/industry/hotel",
    vertical: "hotel",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_HOTEL_URL",
    moduleField: "industryHotelPms",
    title: "Hotel PMS",
    description: "Folio, night audit, channel",
  },
  {
    key: "FNB_POS",
    slug: "industry_fnb_pos",
    href: "/industry/fnb-pos",
    vertical: "fnb-pos",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_FNB_POS_URL",
    moduleField: "industryFnbPos",
    title: "F&B POS",
    description: "Restaurant POS, KDS, bridge",
  },
];

const LEGACY_SLUG_TO_ITEM: Record<string, IndustryModuleSlug> = {
  industry_retail_ecom: "industry_retail",
  industry_logistics_customs: "industry_logistics",
  industry_crm_whatsapp: "industry_crm",
  industry_auto_sto: "industry_auto_service",
  industry_fb_pos: "industry_fnb_pos",
};

const LEGACY_MODULE_FIELD: Record<string, string> = {
  industryRetailEcom: "industryRetail",
  industryLogisticsCustoms: "industryLogistics",
  industryCrmWhatsapp: "industryCrm",
  industryAutoSto: "industryAutoService",
  industryFbPos: "industryFnbPos",
};

export function industryItemByVertical(
  vertical: string,
): (typeof INDUSTRY_NAV_ITEMS)[number] | undefined {
  const normalized =
    vertical === "fb-pos" ? "fnb-pos" : vertical === "auto" ? "auto-service" : vertical;
  return INDUSTRY_NAV_ITEMS.find((i) => i.vertical === normalized);
}

function readEnvRecord(): Record<string, string | undefined> {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as Record<string, string | undefined>;
}

export function satelliteUrlForItem(
  item: (typeof INDUSTRY_NAV_ITEMS)[number],
  env: Record<string, string | undefined> = {},
): string | null {
  const e = Object.keys(env).length > 0 ? env : readEnvRecord();
  const primary = e[item.satelliteUrlEnv];
  if (primary) return primary;
  if (item.key === "FNB_POS") {
    return (
      e.NEXT_PUBLIC_SATELLITE_FNB_POS_URL ??
      e.NEXT_PUBLIC_SATELLITE_FB_POS_URL ??
      e.ERA_FNB_POS_ORIGIN ??
      null
    );
  }
  const eraOrigins: Partial<Record<IndustryModuleKey, string>> = {
    RETAIL: e.ERA_RETAIL_ORIGIN,
    LOGISTICS: e.ERA_LOGISTICS_ORIGIN,
    CONSTRUCTION: e.ERA_CONSTRUCTION_ORIGIN,
    CRM: e.ERA_CRM_ORIGIN,
    AUTO_SERVICE: e.ERA_AUTO_SERVICE_ORIGIN,
    CLINIC: e.ERA_CLINIC_ORIGIN,
    WHOLESALE: e.ERA_WHOLESALE_ORIGIN,
    HOTEL_PMS: e.ERA_HOTEL_PMS_ORIGIN,
  };
  return eraOrigins[item.key] ?? null;
}

function moduleEnabled(
  snap: SubscriptionModulesSnapshot,
  item: (typeof INDUSTRY_NAV_ITEMS)[number],
): boolean {
  const activeModules = Array.isArray(snap.activeModules) ? snap.activeModules : [];
  const modules =
    snap.modules && typeof snap.modules === "object" ? snap.modules : {};
  if (activeModules.includes(item.slug)) return true;
  for (const legacy of LEGACY_INDUSTRY_MODULE_SLUGS) {
    if (LEGACY_SLUG_TO_ITEM[legacy] === item.slug && activeModules.includes(legacy)) {
      return true;
    }
  }
  if (modules[item.moduleField]) return true;
  for (const [legacyField, canonicalField] of Object.entries(LEGACY_MODULE_FIELD)) {
    if (canonicalField === item.moduleField && modules[legacyField]) return true;
  }
  return false;
}

export function hasIndustryModuleAccess(
  snap: SubscriptionModulesSnapshot | null,
  key: IndustryModuleKey | LegacyIndustryModuleKey,
): boolean {
  if (!snap) return false;
  const legacyKeyMap: Record<LegacyIndustryModuleKey, IndustryModuleKey> = {
    RETAIL_ECOM: "RETAIL",
    LOGISTICS_CUSTOMS: "LOGISTICS",
    CRM_WHATSAPP: "CRM",
    AUTO_STO: "AUTO_SERVICE",
    FB_POS: "FNB_POS",
  };
  const normalized =
    key in legacyKeyMap
      ? legacyKeyMap[key as LegacyIndustryModuleKey]
      : (key as IndustryModuleKey);
  const item = INDUSTRY_NAV_ITEMS.find((i) => i.key === normalized);
  if (!item) return false;
  return moduleEnabled(snap, item);
}

/** Finance core tile — always available when user has any org membership. */
export const FINANCE_TILE = {
  vertical: "finance",
  href: "/open/finance",
  title: "Finance Core",
  description: "GL, AR, holding, contracts",
  urlEnv: "NEXT_PUBLIC_FINANCE_WEB_URL",
} as const;

export function financeWebUrl(
  env: Record<string, string | undefined> = {},
): string | null {
  const e = Object.keys(env).length > 0 ? env : readEnvRecord();
  return (
    e[FINANCE_TILE.urlEnv] ??
    e.NEXT_PUBLIC_FINANCE_WEB_URL ??
    e.ERA_FINANCE_ORIGIN ??
    null
  );
}
