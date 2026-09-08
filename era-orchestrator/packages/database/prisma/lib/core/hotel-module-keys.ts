import { isPassThroughCatalogModuleKeyExtended } from "./pricing-catalog-canon";

/** Canonical hotel PMS submodule keys (`pricing_modules`) — hotel submodule taxonomy. */
export const HOTEL_PRICING_MODULE_KEYS = [
  "hotel_core",
  "hotel_housekeeping",
  "hotel_service",
  "hotel_migration_pro",
  "hotel_transfers",
  "hotel_spa_scheduling",
  "hotel_distribution",
  "hotel_agency_portal",
  "hotel_guest_experience",
  "hotel_banquets",
  "hotel_medical_sanatorium",
  "hotel_setup_advanced",
] as const;

export type HotelPricingModuleKey = (typeof HOTEL_PRICING_MODULE_KEYS)[number];

/** Legacy keys consolidated into the 9-key taxonomy (dual-read). */
export const HOTEL_MODULE_KEY_ALIASES: Record<string, HotelPricingModuleKey> = {
  hotel_front_office: "hotel_core",
  hotel_front_cash: "hotel_core",
  hotel_night_audit: "hotel_core",
  hotel_channel_ota: "hotel_distribution",
  hotel_contracts_yield: "hotel_distribution",
  migration_pro: "hotel_migration_pro",
};

/** @deprecated Use HOTEL_MODULE_KEY_ALIASES */
export const HOTEL_LEGACY_MODULE_KEYS = Object.keys(HOTEL_MODULE_KEY_ALIASES);

export const HOTEL_PRICING_BUNDLE_KEYS = {
  CITY: "hotel_bundle_city",
  RESORT: "hotel_bundle_resort",
  SANATORIUM: "hotel_bundle_sanatorium",
} as const;

export const INDUSTRY_SATELLITE_MODULE_KEYS = [
  "industry_hotel_pms",
  "industry_fnb_pos",
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_clinic",
  "industry_wholesale",
  "industry_banking",
] as const;

export const BANKING_PRICING_MODULE_KEYS = [
  "banking_core",
  "banking_deposits",
  "banking_loans",
  "banking_cards",
  "banking_payments",
  "banking_aml",
  "banking_treasury",
  "banking_dbo",
  "banking_regreporting",
  "banking_risk",
  "banking_trade",
  "banking_collections",
  "banking_cash",
  "banking_islamic",
  "banking_wealth",
  "banking_markets",
  "banking_pension",
  "banking_psa",
] as const;

/** Clinic modules (MODULES_CATALOG M0–M14). */
export const CLINIC_PRICING_MODULE_KEYS = [
  "clinic_shell",
  "clinic_patients",
  "clinic_schedule",
  "clinic_appointments",
  "clinic_visit",
  "clinic_lab",
  "clinic_service_catalog",
  "clinic_notifications",
  "clinic_portal",
  "clinic_reschedule",
  "clinic_ehr",
  "clinic_lis_import",
  "clinic_insurance",
  "clinic_inpatient",
  "clinic_telehealth",
  "clinic_nurse_roster",
  "clinic_registry_emr",
  "clinic_sanatorium_clinical",
] as const;

export type ClinicPricingModuleKey = (typeof CLINIC_PRICING_MODULE_KEYS)[number];

export type IndustrySatelliteModuleKey = (typeof INDUSTRY_SATELLITE_MODULE_KEYS)[number];

/** Resolve canonical hotel module key (handles legacy slugs). */
export function resolveHotelModuleKey(moduleKey: string): string {
  return HOTEL_MODULE_KEY_ALIASES[moduleKey] ?? moduleKey;
}

/** Consolidate legacy hotel keys in an activeModules array. */
export function consolidateHotelModuleKeys(modules: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of modules) {
    const key = raw.trim();
    if (!key) continue;
    out.add(resolveHotelModuleKey(key));
  }
  return [...out];
}

/** True when snapshot activeModules includes module (legacy alias aware). */
export function isHotelModuleActive(
  activeModules: readonly string[],
  moduleKey: string,
): boolean {
  const canonical = resolveHotelModuleKey(moduleKey);
  const set = new Set(activeModules.map((m) => resolveHotelModuleKey(m)));
  return set.has(canonical);
}

export function isPassThroughCatalogModuleKey(moduleKey: string): boolean {
  return isPassThroughCatalogModuleKeyExtended(moduleKey);
}

/** Infer PricingCatalogKind from module key prefix. */
export function inferPricingCatalogKind(key: string): "SATELLITE" | "MODULE" | "ADDON" {
  if (key.startsWith("industry_")) return "SATELLITE";
  if (key.startsWith("platform_")) return "ADDON";
  return "MODULE";
}
