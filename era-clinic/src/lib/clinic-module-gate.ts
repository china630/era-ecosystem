import { headers } from "next/headers";
import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
  resolveClinicModuleForPathname,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

const ERA_PATHNAME_HEADER = "x-era-pathname";

const AUTH_EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/internal",
  "/api/cron",
  "/api/booking",
  "/api/portal",
  "/api/integration",
  "/login",
  "/sso",
];

/** Satellite entitlement gate — fail-closed (AC Scaffold BE). */
export async function requireClinicSatellite(): Promise<void> {
  await requireSatelliteModule("industry_clinic");
}

export async function requireClinicModule(moduleKey: string): Promise<void> {
  await requireSatelliteModule(moduleKey);
}

/** Call at the start of operational clinic API handlers (satellite SKU). */
export async function assertClinicEntitled(): Promise<void> {
  await requireClinicSatellite();
}

/** Satellite gate + submodule when path maps. */
export async function assertClinicApiEntitled(pathname?: string | null): Promise<void> {
  const path =
    pathname?.trim() ||
    (await headers()).get(ERA_PATHNAME_HEADER)?.trim() ||
    "";
  if (!path || AUTH_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return;
  }
  await requireClinicSatellite();
  const moduleKey = resolveClinicModuleForPathname(path);
  if (moduleKey) {
    await requireClinicModule(moduleKey);
  }
}
