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
  "/api/integration",
  "/login",
  "/sso",
];

/** Satellite entitlement gate — fail-closed (AC Scaffold BE). The org comes from the session. */
export async function requireClinicSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_clinic");
  await requireSatelliteModule("industry_clinic", { organizationId: org });
}

export async function requireClinicModule(
  moduleKey: string,
  organizationId: string,
): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError(moduleKey);
  await requireSatelliteModule(moduleKey, { organizationId: org });
}

/** Satellite gate + submodule when the request path maps to one. */
export async function assertClinicApiEntitled(
  pathname: string | null | undefined,
  organizationId: string,
): Promise<void> {
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
  await requireClinicSatellite(organizationId);
  const moduleKey = resolveClinicModuleForPathname(path);
  if (moduleKey) {
    await requireClinicModule(moduleKey, organizationId);
  }
}
