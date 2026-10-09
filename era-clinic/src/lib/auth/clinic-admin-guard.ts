import {
  getSatelliteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { adminApiRoutePermissions } from "@/lib/auth/clinic-permissions";
import type { NextResponse } from "next/server";
import type { SatelliteStaffSessionPayload } from "@era/satellite-kit";

type GuardOk = { session: SatelliteStaffSessionPayload; error?: undefined };
type GuardFail = { session?: undefined; error: NextResponse };

/** Permission-mapped admin API gate (Wave 2 — CLINIC_ADMIN matrix applies). */
export async function assertClinicAdminRoute(
  req: Request,
): Promise<GuardOk | GuardFail> {
  const session = await getSatelliteSession();
  if (!session) return { error: jsonError("Unauthorized", 401) };
  const permissions = adminApiRoutePermissions(new URL(req.url).pathname);
  if (!permissions || permissions.length === 0) return { error: jsonError("Forbidden", 403) };
  let denied: NextResponse | null = null;
  for (const permission of permissions) {
    denied = await requireClinicPermission(session, permission);
    if (!denied) return { session };
  }
  return { error: denied ?? jsonError("Forbidden", 403) };
}

/** Alias of assertClinicAdminRoute — Request required (no binary CLINIC_ADMIN bypass). */
export async function assertClinicAdminRead(
  req: Request,
): Promise<GuardOk | GuardFail> {
  return assertClinicAdminRoute(req);
}

/** Alias of assertClinicAdminRoute — Request required. */
export async function assertClinicAdminWrite(
  req: Request,
): Promise<GuardOk | GuardFail> {
  return assertClinicAdminRoute(req);
}
