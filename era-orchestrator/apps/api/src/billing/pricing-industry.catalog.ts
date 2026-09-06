import { BANKING_PRICING_MODULE_KEYS } from "@era365/database";

/** Industry satellite groups + banking bundle marketing for the public storefront. */

export const INDUSTRY_STOREFRONT_GROUP_ORDER = [
  "industry_hotel_pms",
  "industry_clinic",
  "industry_fnb_pos",
  "industry_retail",
  "industry_auto_service",
  "industry_logistics",
  "industry_construction",
  "industry_wholesale",
  "industry_crm",
  "industry_banking",
] as const;

export type IndustryStorefrontGroupKey = (typeof INDUSTRY_STOREFRONT_GROUP_ORDER)[number];

export const BANKING_RETAIL_BUNDLE_KEYS = [
  "banking_core",
  "banking_deposits",
  "banking_loans",
  "banking_cards",
  "banking_payments",
  "banking_dbo",
  "banking_aml",
] as const;

export const PRICING_INDUSTRY_BUNDLE_MARKETING: readonly {
  matchModuleKeys: readonly string[];
  marketingId: string;
}[] = [
  {
    marketingId: "banking_retail",
    matchModuleKeys: BANKING_RETAIL_BUNDLE_KEYS,
  },
  {
    marketingId: "banking_universal",
    matchModuleKeys: BANKING_PRICING_MODULE_KEYS,
  },
];

const WORKFORCE_PLATFORM_KEYS = new Set([
  "platform_workforce",
  "platform_workforce_base",
  "platform_workforce_pro",
]);

export function isWorkforcePlatformKey(key: string): boolean {
  return WORKFORCE_PLATFORM_KEYS.has(key);
}

export function bundleIndustrySatelliteKey(moduleKeys: readonly string[]): string | null {
  if (moduleKeys.some((k) => k.startsWith("hotel_"))) return "industry_hotel_pms";
  if (moduleKeys.some((k) => k.startsWith("clinic_"))) return "industry_clinic";
  if (moduleKeys.some((k) => k.startsWith("fnb_"))) return "industry_fnb_pos";
  if (moduleKeys.some((k) => k.startsWith("retail_"))) return "industry_retail";
  if (moduleKeys.some((k) => k.startsWith("banking_"))) return "industry_banking";
  return null;
}
