/** Virtual finance satellite key — same connect/trial rules as industry satellites. */
export const FINANCE_CORE_SATELLITE_KEY = "finance_core";

export const INDUSTRY_SATELLITE_KEYS = [
  "industry_hotel_pms",
  "industry_fnb_pos",
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_clinic",
  "industry_wholesale",
] as const;

export type IndustrySatelliteKey = (typeof INDUSTRY_SATELLITE_KEYS)[number];

export const WORKSPACE_SATELLITE_KEYS: Record<string, string> = {
  FINANCE: FINANCE_CORE_SATELLITE_KEY,
  HOTEL_PMS: "industry_hotel_pms",
  FNB_POS: "industry_fnb_pos",
  RETAIL: "industry_retail",
  LOGISTICS: "industry_logistics",
  CONSTRUCTION: "industry_construction",
  CRM: "industry_crm",
  AUTO_SERVICE: "industry_auto_service",
  CLINIC: "industry_clinic",
  WHOLESALE: "industry_wholesale",
};

export function resolveSatelliteGateSlug(satelliteKey: string): string | null {
  if (satelliteKey === FINANCE_CORE_SATELLITE_KEY) return null;
  if (satelliteKey.startsWith("industry_")) return satelliteKey;
  return null;
}

export function isKnownSatelliteKey(key: string): boolean {
  if (key === FINANCE_CORE_SATELLITE_KEY) return true;
  return (INDUSTRY_SATELLITE_KEYS as readonly string[]).includes(key);
}
