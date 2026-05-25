import type { EarlyAccessModuleKey } from "../components/early-access/modules.config";
import type { SubscriptionSnapshot } from "./subscription-context";

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

export const INDUSTRY_NAV_ITEMS: Array<{
  key: EarlyAccessModuleKey;
  slug: IndustryModuleSlug;
  href: string;
  vertical: string;
  satelliteUrlEnv: string;
  moduleField:
    | "industryRetailEcom"
    | "industryLogisticsCustoms"
    | "industryConstruction"
    | "industryCrmWhatsapp"
    | "industryAutoSto"
    | "industryClinic"
    | "industryWholesale"
    | "industryHotelPms"
    | "industryFbPos";
  labelKey:
    | "nav.industryRetailEcom"
    | "nav.industryLogisticsCustoms"
    | "nav.industryConstruction"
    | "nav.industryCrmWhatsapp"
    | "nav.industryAutoSto"
    | "nav.industryClinic"
    | "nav.industryWholesale"
    | "nav.industryHotelPms"
    | "nav.industryFbPos";
}> = [
  {
    key: "RETAIL_ECOM",
    slug: "industry_retail_ecom",
    href: "/industry/retail",
    vertical: "retail",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_RETAIL_URL",
    moduleField: "industryRetailEcom",
    labelKey: "nav.industryRetailEcom",
  },
  {
    key: "LOGISTICS_CUSTOMS",
    slug: "industry_logistics_customs",
    href: "/industry/logistics",
    vertical: "logistics",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_LOGISTICS_URL",
    moduleField: "industryLogisticsCustoms",
    labelKey: "nav.industryLogisticsCustoms",
  },
  {
    key: "CONSTRUCTION",
    slug: "industry_construction",
    href: "/industry/construction",
    vertical: "construction",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL",
    moduleField: "industryConstruction",
    labelKey: "nav.industryConstruction",
  },
  {
    key: "CRM_WHATSAPP",
    slug: "industry_crm_whatsapp",
    href: "/industry/crm",
    vertical: "crm",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CRM_URL",
    moduleField: "industryCrmWhatsapp",
    labelKey: "nav.industryCrmWhatsapp",
  },
  {
    key: "AUTO_STO",
    slug: "industry_auto_sto",
    href: "/industry/auto",
    vertical: "auto",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_AUTO_URL",
    moduleField: "industryAutoSto",
    labelKey: "nav.industryAutoSto",
  },
  {
    key: "CLINIC",
    slug: "industry_clinic",
    href: "/industry/clinic",
    vertical: "clinic",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_CLINIC_URL",
    moduleField: "industryClinic",
    labelKey: "nav.industryClinic",
  },
  {
    key: "WHOLESALE",
    slug: "industry_wholesale",
    href: "/industry/wholesale",
    vertical: "wholesale",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_WHOLESALE_URL",
    moduleField: "industryWholesale",
    labelKey: "nav.industryWholesale",
  },
  {
    key: "HOTEL_PMS",
    slug: "industry_hotel_pms",
    href: "/industry/hotel",
    vertical: "hotel",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_HOTEL_URL",
    moduleField: "industryHotelPms",
    labelKey: "nav.industryHotelPms",
  },
  {
    key: "FB_POS",
    slug: "industry_fb_pos",
    href: "/industry/fb-pos",
    vertical: "fb-pos",
    satelliteUrlEnv: "NEXT_PUBLIC_SATELLITE_FB_POS_URL",
    moduleField: "industryFbPos",
    labelKey: "nav.industryFbPos",
  },
];

export function industryItemByVertical(
  vertical: string,
): (typeof INDUSTRY_NAV_ITEMS)[number] | undefined {
  return INDUSTRY_NAV_ITEMS.find((i) => i.vertical === vertical);
}

export function satelliteUrlForItem(
  item: (typeof INDUSTRY_NAV_ITEMS)[number],
): string | null {
  const map: Record<string, string | undefined> = {
    NEXT_PUBLIC_SATELLITE_RETAIL_URL: process.env.NEXT_PUBLIC_SATELLITE_RETAIL_URL,
    NEXT_PUBLIC_SATELLITE_LOGISTICS_URL:
      process.env.NEXT_PUBLIC_SATELLITE_LOGISTICS_URL,
    NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL:
      process.env.NEXT_PUBLIC_SATELLITE_CONSTRUCTION_URL,
    NEXT_PUBLIC_SATELLITE_CRM_URL: process.env.NEXT_PUBLIC_SATELLITE_CRM_URL,
    NEXT_PUBLIC_SATELLITE_AUTO_URL: process.env.NEXT_PUBLIC_SATELLITE_AUTO_URL,
    NEXT_PUBLIC_SATELLITE_CLINIC_URL: process.env.NEXT_PUBLIC_SATELLITE_CLINIC_URL,
    NEXT_PUBLIC_SATELLITE_WHOLESALE_URL:
      process.env.NEXT_PUBLIC_SATELLITE_WHOLESALE_URL,
    NEXT_PUBLIC_SATELLITE_HOTEL_URL: process.env.NEXT_PUBLIC_SATELLITE_HOTEL_URL,
    NEXT_PUBLIC_SATELLITE_FB_POS_URL: process.env.NEXT_PUBLIC_SATELLITE_FB_POS_URL,
  };
  return map[item.satelliteUrlEnv] ?? null;
}

export function hasIndustryModuleAccess(
  snap: SubscriptionSnapshot | null,
  key: EarlyAccessModuleKey,
): boolean {
  if (!snap) return false;
  const item = INDUSTRY_NAV_ITEMS.find((i) => i.key === key);
  if (!item) return false;
  if (snap.activeModules.includes(item.slug)) return true;
  return Boolean(snap.modules[item.moduleField]);
}
