/** Hotel PMS submodule keys — synced with @era365/database hotel-module-keys.ts */

export const HOTEL_PRICING_MODULE_KEYS = [
  "hotel_core",
  "hotel_housekeeping",
  "hotel_service",
  "hotel_migration_pro",
  "hotel_transfers",
  "hotel_spa_scheduling",
  "hotel_distribution",
  "hotel_guest_experience",
  "hotel_banquets",
  "hotel_medical_sanatorium",
  "hotel_setup_advanced",
] as const;

export type HotelPricingModuleKey = (typeof HOTEL_PRICING_MODULE_KEYS)[number];

export const HOTEL_MODULE_KEY_ALIASES: Record<string, HotelPricingModuleKey> = {
  hotel_front_office: "hotel_core",
  hotel_front_cash: "hotel_core",
  hotel_night_audit: "hotel_core",
  hotel_channel_ota: "hotel_distribution",
  hotel_contracts_yield: "hotel_distribution",
  migration_pro: "hotel_migration_pro",
};

export function resolveHotelModuleKey(moduleKey: string): string {
  return HOTEL_MODULE_KEY_ALIASES[moduleKey] ?? moduleKey;
}

export function consolidateHotelModuleKeys(modules: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of modules) {
    const key = raw.trim();
    if (!key) continue;
    out.add(resolveHotelModuleKey(key));
  }
  return [...out];
}

export function isHotelModuleActive(
  activeModules: readonly string[],
  moduleKey: string,
): boolean {
  const canonical = resolveHotelModuleKey(moduleKey);
  const set = new Set(activeModules.map((m) => resolveHotelModuleKey(m)));
  return set.has(canonical);
}

/** Route prefix → required hotel module key (9-key taxonomy). */
export const HOTEL_MODULE_BY_ROUTE: Record<string, string> = {
  "/": "hotel_core",
  "/bookings": "hotel_core",
  "/room-plan": "hotel_core",
  "/in-house": "hotel_core",
  "/folio": "hotel_core",
  "/operations": "hotel_core",
  "/reports/reservations": "hotel_core",
  "/reports/inhouse-daily": "hotel_core",
  "/reports/end-of-day-logs": "hotel_core",
  "/housekeeping": "hotel_housekeeping",
  "/hk": "hotel_housekeeping",
  "/service": "hotel_service",
  "/migration": "hotel_migration_pro",
  "/channel": "hotel_distribution",
  "/admin/contract-pricing": "hotel_distribution",
  "/admin/promotion-codes": "hotel_distribution",
  "/admin/travel-agencies": "hotel_distribution",
  "/admin/child-matrix": "hotel_distribution",
  "/medical": "hotel_medical_sanatorium",
  "/procedures": "hotel_spa_scheduling",
  "/spa": "hotel_spa_scheduling",
  "/transfers": "hotel_transfers",
  "/transfers/airport": "hotel_transfers",
  "/banquets": "hotel_banquets",
  "/guests": "hotel_guest_experience",
  "/admin/master-data": "hotel_setup_advanced",
};

export function resolveHotelModuleForPathname(pathname: string): string | null {
  const sorted = Object.keys(HOTEL_MODULE_BY_ROUTE).sort((a, b) => b.length - a.length);
  const prefix = sorted.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return prefix ? HOTEL_MODULE_BY_ROUTE[prefix]! : null;
}
