/** Hotel PMS submodule keys — synced with @era365/database hotel-module-keys.ts */

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

/**
 * Route prefix → required hotel module key (9-key taxonomy).
 * Canon: era-hotel-pms/doc/MENU-IA-CANON.md — FO=/fo, HK=/hk, etc.
 */
export const HOTEL_MODULE_BY_ROUTE: Record<string, string> = {
  "/": "hotel_core",
  "/fo": "hotel_core",
  "/bookings": "hotel_core",
  "/folio": "hotel_core",
  "/front-cash": "hotel_core",
  "/night-audit": "hotel_core",
  // legacy FO / NA (redirect targets still resolve during cutover)
  "/availability": "hotel_core",
  "/room-plan": "hotel_core",
  "/in-house": "hotel_core",
  "/operations": "hotel_core",
  "/reports/reservations": "hotel_core",
  "/reports/inhouse-daily": "hotel_core",
  "/reports/end-of-day-logs": "hotel_core",
  "/hk": "hotel_housekeeping",
  "/housekeeping": "hotel_housekeeping",
  "/api/housekeeping": "hotel_housekeeping",
  "/service": "hotel_service",
  "/api/service": "hotel_service",
  "/migration": "hotel_migration_pro",
  "/api/migration": "hotel_migration_pro",
  "/api/import": "hotel_migration_pro",
  "/distribution": "hotel_distribution",
  "/channel": "hotel_distribution",
  "/api/channel": "hotel_distribution",
  "/admin/contract-pricing": "hotel_distribution",
  "/admin/contracts": "hotel_distribution",
  "/api/admin/contracts": "hotel_distribution",
  "/admin/allotment-blocks": "hotel_distribution",
  "/api/admin/allotment-blocks": "hotel_distribution",
  "/admin/promotion-codes": "hotel_distribution",
  "/admin/travel-agencies": "hotel_distribution",
  "/api/admin/travel-agencies": "hotel_distribution",
  "/agency": "hotel_agency_portal",
  "/api/agency": "hotel_agency_portal",
  "/fo/agency-inbox": "hotel_core",
  "/api/fo/agency-inbox": "hotel_core",
  "/admin/child-matrix": "hotel_distribution",
  "/admin/yield-rules": "hotel_distribution",
  "/api/admin/yield-rules": "hotel_distribution",
  "/medical": "hotel_medical_sanatorium",
  "/api/medical": "hotel_medical_sanatorium",
  "/api/clinic": "hotel_medical_sanatorium",
  "/procedures": "hotel_spa_scheduling",
  "/spa": "hotel_spa_scheduling",
  "/api/spa": "hotel_spa_scheduling",
  "/transfers": "hotel_transfers",
  "/api/transfers": "hotel_transfers",
  "/transfers/airport": "hotel_transfers",
  "/banquets": "hotel_banquets",
  "/api/banquets": "hotel_banquets",
  "/guests": "hotel_guest_experience",
  "/api/guests": "hotel_guest_experience",
  "/settings": "hotel_setup_advanced",
  "/admin/master-data": "hotel_setup_advanced",
  "/admin/bar-calendar": "hotel_setup_advanced",
  "/api/admin/auto-bar": "hotel_setup_advanced",
  "/api/cron/auto-bar": "hotel_setup_advanced",
  "/api/cron/allotment-block-cutoff": "hotel_distribution",
  "/admin/users": "hotel_setup_advanced",
  "/admin/integration": "hotel_setup_advanced",
  "/admin/audit": "hotel_setup_advanced",
  "/admin/stock": "hotel_setup_advanced",
  "/admin/import": "hotel_setup_advanced",
};

export function resolveHotelModuleForPathname(pathname: string): string | null {
  const sorted = Object.keys(HOTEL_MODULE_BY_ROUTE).sort((a, b) => b.length - a.length);
  const prefix = sorted.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return prefix ? HOTEL_MODULE_BY_ROUTE[prefix]! : null;
}
