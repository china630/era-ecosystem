import { headers } from "next/headers";
import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
  resolveClinicModuleForPathname,
  enterSatelliteTenant,
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

async function requestOrganizationIdFromHeaders(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-era-organization-id")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function enterTenantFromRequestHeaders(): Promise<string | undefined> {
  const org = await requestOrganizationIdFromHeaders();
  if (org) enterSatelliteTenant({ organizationId: org });
  return org;
}

/** Satellite entitlement gate — fail-closed (AC Scaffold BE). */
export async function requireClinicSatellite(organizationId?: string): Promise<void> {
  const org = organizationId?.trim() || (await enterTenantFromRequestHeaders());
  if (org) {
    await requireSatelliteModule("industry_clinic", { organizationId: org });
    return;
  }
  await requireSatelliteModule("industry_clinic");
}

export async function requireClinicModule(
  moduleKey: string,
  organizationId?: string,
): Promise<void> {
  const org = organizationId?.trim() || (await enterTenantFromRequestHeaders());
  if (org) {
    await requireSatelliteModule(moduleKey, { organizationId: org });
    return;
  }
  await requireSatelliteModule(moduleKey);
}

/** Call at the start of operational clinic API handlers (satellite SKU). */
export async function assertClinicEntitled(organizationId?: string): Promise<void> {
  await requireClinicSatellite(organizationId);
}

/** Satellite gate + submodule when path maps. */
export async function assertClinicApiEntitled(
  pathname?: string | null,
  organizationId?: string,
): Promise<void> {
  const org = organizationId?.trim() || (await enterTenantFromRequestHeaders());
  let path = pathname?.trim() || "";
  if (!path) {
    try {
      path = (await headers()).get(ERA_PATHNAME_HEADER)?.trim() || "";
    } catch {
      path = "";
    }
  }
  if (!path || AUTH_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return;
  }
  await requireClinicSatellite(org);
  const moduleKey = resolveClinicModuleForPathname(path);
  if (moduleKey) {
    await requireClinicModule(moduleKey, org);
  }
}
