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

/** Fail-closed hotel submodule gate. The org comes from the session (or S2S caller). */
export async function requireHotelModule(
  moduleKey: string,
  organizationId: string,
): Promise<void> {
  const org = organizationId?.trim();
  const key = resolveHotelModuleKey(moduleKey);
  if (!org) throw new IndustryModuleInactiveError(key);
  await requireSatelliteModule(key, { organizationId: org });
}

/** Always require satellite gate; submodule when path maps. */
export async function assertHotelApiEntitled(
  pathname: string | null | undefined,
  organizationId: string,
): Promise<void> {
  const org = organizationId?.trim();
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
  if (!org) throw new IndustryModuleInactiveError("industry_hotel_pms");
  await requireSatelliteModule("industry_hotel_pms", { organizationId: org });
  const moduleKey = resolveHotelModuleForPathname(path);
  if (moduleKey) {
    await requireHotelModule(moduleKey, org);
  }
}
