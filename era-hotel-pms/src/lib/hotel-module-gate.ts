import { headers } from "next/headers";
import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
  resolveHotelModuleKey,
  resolveHotelModuleForPathname,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

const ERA_PATHNAME_HEADER = "x-era-pathname";

const AUTH_EXEMPT_PREFIXES = [
  "/api/auth",
  "/api/internal",
  "/login",
  "/sso",
];

/**
 * Fail-closed hotel submodule gate. Bound org required
 * (no silent skip on env fallback).
 */
export async function requireHotelModule(moduleKey: string): Promise<void> {
  await requireSatelliteModule(resolveHotelModuleKey(moduleKey));
}

/** Always require satellite gate; submodule when path maps. */
export async function assertHotelApiEntitled(pathname?: string | null): Promise<void> {
  const path =
    pathname?.trim() ||
    (await headers()).get(ERA_PATHNAME_HEADER)?.trim() ||
    "";
  if (!path || AUTH_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return;
  }
  await requireSatelliteModule("industry_hotel_pms");
  const moduleKey = resolveHotelModuleForPathname(path);
  if (moduleKey) {
    await requireHotelModule(moduleKey);
  }
}
