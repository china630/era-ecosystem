import {
  fetchSubscriptionSnapshot,
  hasActiveModule,
} from "./platform-hook-policy";
import {
  HOTEL_MODULE_BY_ROUTE,
  isHotelModuleActive,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from "./hotel-module-keys";

export {
  HOTEL_MODULE_BY_ROUTE,
  HOTEL_MODULE_KEY_ALIASES,
  HOTEL_PRICING_MODULE_KEYS,
  consolidateHotelModuleKeys,
  isHotelModuleActive,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from "./hotel-module-keys";

export class IndustryModuleInactiveError extends Error {
  readonly status = 403;
  readonly moduleKey: string;

  constructor(moduleKey: string) {
    super(`Industry module not active: ${moduleKey}`);
    this.name = "IndustryModuleInactiveError";
    this.moduleKey = moduleKey;
  }
}

export async function assertHotelModuleActive(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  const snapshot = await fetchSubscriptionSnapshot(organizationId);
  const canonical = resolveHotelModuleKey(moduleKey);
  if (!snapshot) {
    throw new IndustryModuleInactiveError(canonical);
  }
  const active = parseActiveModulesFromSnapshot(snapshot);
  if (!isHotelModuleActive(active, canonical)) {
    throw new IndustryModuleInactiveError(canonical);
  }
}

function parseActiveModulesFromSnapshot(snapshot: Record<string, unknown>): string[] {
  const raw = snapshot.activeModules;
  if (!Array.isArray(raw)) return [];
  const hotelModules = snapshot.hotelModules as Record<string, boolean> | undefined;
  if (hotelModules && typeof hotelModules === "object") {
    const fromMap = Object.entries(hotelModules)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (fromMap.length) {
      return [...new Set([...raw.filter((m): m is string => typeof m === "string"), ...fromMap])];
    }
  }
  return raw.filter((m): m is string => typeof m === "string");
}

export async function assertHotelModuleForRoute(
  organizationId: string,
  pathname: string,
): Promise<void> {
  const moduleKey = resolveHotelModuleForPathname(pathname);
  if (!moduleKey) return;
  await assertHotelModuleActive(organizationId, moduleKey);
}

export const INDUSTRY_MODULE_BY_APP = {
  hotel: "industry_hotel_pms",
  fb: "industry_fb_pos",
  retail: "industry_retail_ecom",
  logistics: "industry_logistics_customs",
  construction: "industry_construction",
  crm: "industry_crm_whatsapp",
  auto: "industry_auto_sto",
  clinic: "industry_clinic",
  wholesale: "industry_wholesale",
} as const;

export type IndustryAppKey = keyof typeof INDUSTRY_MODULE_BY_APP;

export async function assertIndustryModuleActive(
  organizationId: string,
  app: IndustryAppKey,
): Promise<void> {
  const moduleKey = INDUSTRY_MODULE_BY_APP[app];
  const snapshot = await fetchSubscriptionSnapshot(organizationId);
  if (!snapshot || !hasActiveModule(snapshot, moduleKey)) {
    throw new IndustryModuleInactiveError(moduleKey);
  }
}

export async function isIndustryModuleActive(
  organizationId: string,
  app: IndustryAppKey,
): Promise<boolean> {
  try {
    await assertIndustryModuleActive(organizationId, app);
    return true;
  } catch {
    return false;
  }
}
