import { headers } from "next/headers";
import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
  resolveHotelModuleKey,
  resolveHotelModuleForPathname,
  enterSatelliteTenant,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

const ERA_PATHNAME_HEADER = "x-era-pathname";

const AUTH_EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/internal",
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

/**
 * Fail-closed hotel submodule gate. Bound org required
 * (no silent skip on env fallback).
 */
export async function requireHotelModule(
  moduleKey: string,
  organizationId?: string,
): Promise<void> {
  const org = organizationId?.trim() || (await enterTenantFromRequestHeaders());
  const key = resolveHotelModuleKey(moduleKey);
  if (org) {
    await requireSatelliteModule(key, { organizationId: org });
    return;
  }
  await requireSatelliteModule(key);
}

/** Always require satellite gate; submodule when path maps. */
export async function assertHotelApiEntitled(
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
  if (org) {
    await requireSatelliteModule("industry_hotel_pms", { organizationId: org });
  } else {
    await requireSatelliteModule("industry_hotel_pms");
  }
  const moduleKey = resolveHotelModuleForPathname(path);
  if (moduleKey) {
    await requireHotelModule(moduleKey, org);
  }
}
