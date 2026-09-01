import {
  SATELLITE_KEY_CLINIC,
  SATELLITE_KEY_FNB,
  SATELLITE_KEY_HOTEL,
  WORKFORCE_OPERATIONAL_SATELLITE_KEYS,
  operationalRolesForSatellite,
} from "@era/contracts";

export type WorkforceUiSatelliteKey = (typeof WORKFORCE_UI_SATELLITES)[number]["key"];

/** UI-only: satelliteKey → workspace.systems i18n slug */
export const WORKFORCE_UI_SATELLITES = [
  { key: SATELLITE_KEY_CLINIC, i18n: "clinic" },
  { key: SATELLITE_KEY_HOTEL, i18n: "hotel" },
  { key: SATELLITE_KEY_FNB, i18n: "fnb" },
] as const;

export { WORKFORCE_OPERATIONAL_SATELLITE_KEYS, operationalRolesForSatellite };

export function rolesForSatellite(satelliteKey: string): readonly string[] {
  return operationalRolesForSatellite(satelliteKey);
}

export function humanizeSatelliteRole(code: string): string {
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
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
};

export function satelliteLoginHref(
  satelliteKey: string,
  organizationId: string,
): string | null {
  const origin = SATELLITE_LOGIN_ORIGIN[satelliteKey];
  if (!origin || !organizationId) return null;
  return `${origin}/login?organizationId=${encodeURIComponent(organizationId)}`;
}
