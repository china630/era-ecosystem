import {
  SATELLITE_KEY_CLINIC,
  SATELLITE_KEY_FNB,
  SATELLITE_KEY_HOTEL,
  SATELLITE_KEY_RETAIL,
  WORKFORCE_OPERATIONAL_SATELLITE_KEYS,
  operationalRolesForSatellite,
} from "@era/contracts";

export type WorkforceUiSatelliteKey = (typeof WORKFORCE_UI_SATELLITES)[number]["key"];

/** UI-only: satelliteKey → workspace.systems i18n slug */
export const WORKFORCE_UI_SATELLITES = [
  { key: SATELLITE_KEY_CLINIC, i18n: "clinic" },
  { key: SATELLITE_KEY_HOTEL, i18n: "hotel" },
  { key: SATELLITE_KEY_FNB, i18n: "fnb" },
  { key: SATELLITE_KEY_RETAIL, i18n: "retail" },
] as const;

/**
 * PIN satellites this org can staff. A missing snapshot yields nothing:
 * do not flash clinic/hotel/F&B/retail before `/v1/subscription/me` returns.
 * Saved templates for a hidden key stay in the database.
 */
export function workforceSatellitesForModules(
  activeModules: readonly string[] | null | undefined,
) {
  if (!activeModules) return [];
  const active = new Set(activeModules);
  return WORKFORCE_UI_SATELLITES.filter((s) => active.has(s.key));
}

export { WORKFORCE_OPERATIONAL_SATELLITE_KEYS, operationalRolesForSatellite };

export type CatalogRole = {
  satelliteKey: string;
  code: string;
  name: string;
  active: boolean;
};

export function catalogRolesFor(
  rows: readonly CatalogRole[],
  satelliteKey: string,
): CatalogRole[] {
  return rows.filter((row) => row.satelliteKey === satelliteKey && row.active);
}

export function catalogRoleName(
  rows: readonly CatalogRole[],
  satelliteKey: string,
  code: string,
): string | null {
  const hit = rows.find(
    (row) => row.satelliteKey === satelliteKey && row.code === code && row.active,
  );
  return hit?.name ?? null;
}

/** Public staff-login origins (SHARED pool). Env overrides for local/dev. */
export const SATELLITE_LOGIN_ORIGIN: Record<string, string> = {
  [SATELLITE_KEY_CLINIC]:
    process.env.NEXT_PUBLIC_SATELLITE_CLINIC_URL?.replace(/\/$/, "") ||
    "https://clinic.era-365.online",
  [SATELLITE_KEY_HOTEL]:
    process.env.NEXT_PUBLIC_SATELLITE_HOTEL_URL?.replace(/\/$/, "") ||
    "https://hotel-pms.era-365.online",
  [SATELLITE_KEY_FNB]:
    process.env.NEXT_PUBLIC_SATELLITE_FNB_POS_URL?.replace(/\/$/, "") ||
    "https://fnb-pos.era-365.online",
  [SATELLITE_KEY_RETAIL]:
    process.env.NEXT_PUBLIC_SATELLITE_RETAIL_URL?.replace(/\/$/, "") ||
    "https://retail-pos.era-365.online",
};

export function satelliteLoginHref(
  satelliteKey: string,
  publicOrgNumber: string | number,
): string | null {
  const origin = SATELLITE_LOGIN_ORIGIN[satelliteKey];
  const orgNo = String(publicOrgNumber ?? "").trim();
  if (!origin || !orgNo) return null;
  return `${origin}/login?org=${encodeURIComponent(orgNo)}`;
}
