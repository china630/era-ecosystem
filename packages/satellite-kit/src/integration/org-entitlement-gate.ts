import { fetchSubscriptionSnapshot } from "./platform-hook-policy";
import {
  HOTEL_MODULE_BY_ROUTE,
  isHotelModuleActive,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from "./hotel-module-keys";
import {
  CLINIC_MODULE_BY_ROUTE,
  isClinicModuleActive,
  resolveClinicModuleForPathname,
} from "./clinic-module-keys";
import { satelliteRuntimeConfig } from "../tenancy/runtime-config-core";
import {
  resolveSatelliteOrganizationId,
  SatelliteOrganizationUnboundError,
} from "../tenancy/organization-bind-core";
import {
  getSatelliteTenantContext,
  resolveSatelliteTenantFilter,
  runWithSatelliteTenant,
} from "../tenancy/satellite-tenant-context";

export {
  HOTEL_MODULE_BY_ROUTE,
  HOTEL_MODULE_KEY_ALIASES,
  HOTEL_PRICING_MODULE_KEYS,
  consolidateHotelModuleKeys,
  isHotelModuleActive,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
} from "./hotel-module-keys";

export {
  CLINIC_MODULE_BY_ROUTE,
  CLINIC_PRICING_MODULE_KEYS,
  isClinicModuleActive,
  resolveClinicModuleForPathname,
} from "./clinic-module-keys";

export class IndustryModuleInactiveError extends Error {
  readonly status = 403;
  readonly moduleKey: string;

  constructor(moduleKey: string) {
    super(`Industry module not active: ${moduleKey}`);
    this.name = "IndustryModuleInactiveError";
    this.moduleKey = moduleKey;
  }
}

/** Canonical industry satellite gates (pricing_modules SATELLITE keys). */
export const INDUSTRY_MODULE_BY_APP = {
  hotel: "industry_hotel_pms",
  fb: "industry_fnb_pos",
  retail: "industry_retail",
  logistics: "industry_logistics",
  construction: "industry_construction",
  crm: "industry_crm",
  auto: "industry_auto_service",
  clinic: "industry_clinic",
  wholesale: "industry_wholesale",
  banking: "industry_banking",
} as const;

/** Dual-read legacy industry slugs → canonical. */
export const INDUSTRY_MODULE_KEY_ALIASES: Record<string, string> = {
  industry_fb_pos: "industry_fnb_pos",
  industry_retail_ecom: "industry_retail",
  industry_logistics_customs: "industry_logistics",
  industry_crm_whatsapp: "industry_crm",
  industry_auto_sto: "industry_auto_service",
};

export type IndustryAppKey = keyof typeof INDUSTRY_MODULE_BY_APP;

export function resolveIndustryModuleKey(moduleKey: string): string {
  return INDUSTRY_MODULE_KEY_ALIASES[moduleKey] ?? moduleKey;
}

function devUnlockAllModules(): boolean {
  if (process.env.ERA_DEV_UNLOCK_ALL_MODULES !== "1") return false;
  // Production must never skip entitlements via compose folklore.
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function parseActiveModulesFromSnapshot(snapshot: Record<string, unknown>): string[] {
  const raw = snapshot.activeModules;
  if (!Array.isArray(raw)) return [];
  const hotelModules = snapshot.hotelModules as Record<string, boolean> | undefined;
  const fromRaw = raw.filter((m): m is string => typeof m === "string");
  if (hotelModules && typeof hotelModules === "object") {
    const fromMap = Object.entries(hotelModules)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (fromMap.length) {
      return [...new Set([...fromRaw, ...fromMap])];
    }
  }
  return fromRaw;
}

/**
 * Prefer live CP snapshot; fall back to last Sync-pushed runtime-config
 * (air-gap / CP unreachable). Never invent entitlements.
 */
export function resolveEntitlementActiveModules(
  snapshot: Record<string, unknown> | null,
): string[] | null {
  if (snapshot) {
    return parseActiveModulesFromSnapshot(snapshot);
  }
  const cached = satelliteRuntimeConfig().activeModules;
  if (Array.isArray(cached) && cached.length > 0) {
    return cached.filter((m): m is string => typeof m === "string");
  }
  return null;
}

function moduleInActiveList(active: readonly string[], moduleKey: string): boolean {
  const canonicalIndustry = resolveIndustryModuleKey(moduleKey);
  const canonicalHotel = resolveHotelModuleKey(moduleKey);
  if (isHotelModuleActive(active, canonicalHotel)) return true;
  if (isClinicModuleActive(active, moduleKey)) return true;
  const set = new Set(
    active.map((m) => resolveIndustryModuleKey(resolveHotelModuleKey(m.trim()))),
  );
  return set.has(canonicalIndustry) || set.has(moduleKey) || set.has(canonicalHotel);
}

/**
 * Fail-closed entitlement check. Throws IndustryModuleInactiveError (403)
 * when module is off or no snapshot/cache is available (unless DEV unlock).
 */
export async function assertEntitled(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  if (devUnlockAllModules()) return;
  const canonical = moduleKey.startsWith("hotel_")
    ? resolveHotelModuleKey(moduleKey)
    : resolveIndustryModuleKey(moduleKey);

  let snapshot: Record<string, unknown> | null = null;
  try {
    snapshot = await fetchSubscriptionSnapshot(organizationId);
  } catch {
    snapshot = null;
  }
  const active = resolveEntitlementActiveModules(snapshot);
  if (!active) {
    throw new IndustryModuleInactiveError(canonical);
  }
  if (!moduleInActiveList(active, moduleKey)) {
    throw new IndustryModuleInactiveError(canonical);
  }
}

/**
 * Request ALS org first (SHARED SSO / session header), then process bind.
 * Fallback env without ALS is fail-closed — that was a production hole.
 * Local unbound + DEV unlock may still pass via assertEntitled.
 */
export async function requireSatelliteModule(moduleKey: string): Promise<void> {
  if (devUnlockAllModules()) return;
  const alsOrg = getSatelliteTenantContext()?.organizationId?.trim();
  if (alsOrg) {
    await assertEntitled(alsOrg, moduleKey);
    return;
  }
  const { organizationId, source } = resolveSatelliteOrganizationId({
    allowFallback: true,
  });
  if (source === "fallback" || !organizationId) {
    throw new IndustryModuleInactiveError(resolveIndustryModuleKey(moduleKey));
  }
  await assertEntitled(organizationId, moduleKey);
}

export type CronEntitlementOpts = {
  /** Satellite gate key, e.g. industry_clinic */
  satelliteKey?: string;
  /** Submodule key, e.g. clinic_lab / hotel_distribution */
  moduleKey?: string;
  /** Authorization header value from cron caller */
  authorization?: string | null;
  /** Env var holding expected Bearer secret (checked when set) */
  cronSecretEnv?: string;
  /**
   * SHARED pool: discover org UUIDs from the satellite DB when
   * `ERA_CRON_ORGANIZATION_IDS` is unset. Env always wins over this callback.
   */
  listOrganizationIds?: () => Promise<string[]>;
  /**
   * Orch SoR pool members (preferred after env, before DB discover).
   * Typically `fetchPoolOrganizationIdsFromOrch`.
   */
  fetchPoolOrganizationIds?: () => Promise<string[]>;
};

export type CronEntitlementResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503; reason: string; moduleKey?: string };

/**
 * Cron guard: 401 if secret configured and missing; skip/403 when not entitled.
 * Callers should return JSON `{ skipped: true, reason }` without side effects.
 */
export async function runCronIfEntitled(
  opts: CronEntitlementOpts,
): Promise<CronEntitlementResult> {
  const envKey = opts.cronSecretEnv ?? "PLATFORM_CRON_SECRET";
  const secret = process.env[envKey]?.trim() ?? process.env.PLATFORM_CRON_SECRET?.trim() ?? "";
  if (secret) {
    const auth = opts.authorization ?? "";
    if (auth !== `Bearer ${secret}`) {
      return { ok: false, status: 401, reason: "unauthorized" };
    }
  }

  if (devUnlockAllModules()) return { ok: true };

  const keys = [opts.satelliteKey, opts.moduleKey].filter(
    (k): k is string => Boolean(k?.trim()),
  );
  if (keys.length === 0) return { ok: true };

  try {
    for (const key of keys) {
      await requireSatelliteModule(key);
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof IndustryModuleInactiveError) {
      return {
        ok: false,
        status: 403,
        reason: "module_inactive",
        moduleKey: err.moduleKey,
      };
    }
    throw err;
  }
}

async function listCronOrganizationIds(
  listOrganizationIds?: () => Promise<string[]>,
  fetchPoolOrganizationIds?: () => Promise<string[]>,
): Promise<string[]> {
  const extra =
    process.env.ERA_CRON_ORGANIZATION_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (extra.length) return [...new Set(extra)];

  if (fetchPoolOrganizationIds) {
    try {
      const fromOrch = await fetchPoolOrganizationIds();
      const ids = [
        ...new Set(
          (fromOrch ?? [])
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean),
        ),
      ];
      if (ids.length) return ids;
    } catch {
      // Fall through to DB discover / bind.
    }
  }

  if (listOrganizationIds) {
    const discovered = await listOrganizationIds();
    const ids = [
      ...new Set(
        (discovered ?? [])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean),
      ),
    ];
    if (ids.length) return ids;
  }

  const filter = resolveSatelliteTenantFilter();
  if (filter.mode === "skip") {
    throw new SatelliteOrganizationUnboundError(
      "cron cannot run with ERA_SKIP_TENANT_FILTER",
    );
  }
  return [filter.organizationId];
}

/**
 * Entitlement gate + fail-closed tenant ALS for each org.
 * Dedicated/on-prem: one bound org.
 * SHARED: `ERA_CRON_ORGANIZATION_IDS` → orch pool members → `listOrganizationIds` → process bind.
 */
export async function runCronForEachTenant<T>(
  opts: CronEntitlementOpts,
  work: (organizationId: string) => Promise<T>,
): Promise<
  | { ok: false; status: 401 | 403 | 503; reason: string; moduleKey?: string }
  | { ok: true; results: T[] }
> {
  const gate = await runCronIfEntitled(opts);
  if (!gate.ok) return gate;
  try {
    const ids = await listCronOrganizationIds(
      opts.listOrganizationIds,
      opts.fetchPoolOrganizationIds,
    );
    const results: T[] = [];
    for (const organizationId of ids) {
      const part = await runWithSatelliteTenant({ organizationId }, () =>
        work(organizationId),
      );
      results.push(await Promise.resolve(part));
    }
    return { ok: true, results };
  } catch (err) {
    if (err instanceof SatelliteOrganizationUnboundError) {
      return { ok: false, status: 503, reason: "satellite_unbound" };
    }
    throw err;
  }
}

export async function assertHotelModuleActive(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  await assertEntitled(organizationId, resolveHotelModuleKey(moduleKey));
}

export async function assertHotelModuleForRoute(
  organizationId: string,
  pathname: string,
): Promise<void> {
  const moduleKey = resolveHotelModuleForPathname(pathname);
  if (!moduleKey) return;
  await assertHotelModuleActive(organizationId, moduleKey);
}

export async function assertClinicModuleActive(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  await assertEntitled(organizationId, moduleKey);
}

export async function assertClinicModuleForRoute(
  organizationId: string,
  pathname: string,
): Promise<void> {
  const moduleKey = resolveClinicModuleForPathname(pathname);
  if (!moduleKey) return;
  await assertClinicModuleActive(organizationId, moduleKey);
}

export async function assertIndustryModuleActive(
  organizationId: string,
  app: IndustryAppKey,
): Promise<void> {
  const moduleKey = INDUSTRY_MODULE_BY_APP[app];
  await assertEntitled(organizationId, moduleKey);
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

/** @deprecated Prefer hasActiveModule + resolveIndustryModuleKey; kept for dual-read. */
export async function assertIndustryModuleActiveLegacyAware(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  await assertEntitled(organizationId, moduleKey);
}
