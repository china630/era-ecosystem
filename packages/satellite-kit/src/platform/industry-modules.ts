/** Industry launcher config — shared by Orchestrator web (SP9). */

export type IndustryModuleKey =
  | "RETAIL_ECOM"
  | "LOGISTICS_CUSTOMS"
  | "CONSTRUCTION"
  | "CRM_WHATSAPP"
  | "AUTO_STO"
  | "CLINIC"
  | "WHOLESALE"
  | "HOTEL_PMS"
  | "FB_POS";

export const INDUSTRY_MODULE_SLUGS = [
  "industry_retail_ecom",
  "industry_logistics_customs",
  "industry_construction",
  "industry_crm_whatsapp",
  "industry_auto_sto",
  "industry_clinic",
  "industry_wholesale",
  "industry_hotel_pms",
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
    key: "RETAIL_ECOM",
    slug: "industry_retail_ecom",
    href: "/industry/retail",
    vertical: "retail",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_RETAIL_URL",
    moduleField: "industryRetailEcom",
    title: "Retail & E-commerce",
    description: "POS, shifts, stock events",
  },
  {
    key: "LOGISTICS_CUSTOMS",
    slug: "industry_logistics_customs",
    href: "/industry/logistics",
    vertical: "logistics",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_LOGISTICS_URL",
    moduleField: "industryLogisticsCustoms",
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
    key: "CRM_WHATSAPP",
    slug: "industry_crm_whatsapp",
    href: "/industry/crm",
    vertical: "crm",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CRM_URL",
    moduleField: "industryCrmWhatsapp",
    title: "CRM & WhatsApp",
    description: "Leads, visits, inbox",
  },
  {
    key: "AUTO_STO",
    slug: "industry_auto_sto",
    href: "/industry/auto",
    vertical: "auto",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_AUTO_URL",
    moduleField: "industryAutoSto",
    title: "Auto STO",
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
    title: "Wholesale",
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
    key: "FB_POS",
    slug: "industry_fb_pos",
    href: "/industry/fb-pos",
    vertical: "fb-pos",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_FB_POS_URL",
    moduleField: "industryFbPos",
    title: "F&B POS",
    description: "Restaurant POS, KDS, bridge",
  },
];

export function industryItemByVertical(
  vertical: string,
): (typeof INDUSTRY_NAV_ITEMS)[number] | undefined {
  return INDUSTRY_NAV_ITEMS.find((i) => i.vertical === vertical);
}

export function satelliteUrlForItem(
  item: (typeof INDUSTRY_NAV_ITEMS)[number],
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): string | null {
  return env[item.satelliteUrlEnv] ?? null;
}

export function hasIndustryModuleAccess(
  snap: SubscriptionModulesSnapshot | null,
  key: IndustryModuleKey,
): boolean {
  if (!snap) return false;
  const item = INDUSTRY_NAV_ITEMS.find((i) => i.key === key);
  if (!item) return false;
  if (snap.activeModules.includes(item.slug)) return true;
  return Boolean(snap.modules[item.moduleField]);
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
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): string | null {
  return env[FINANCE_TILE.urlEnv] ?? env.NEXT_PUBLIC_FINANCE_WEB_URL ?? null;
}
