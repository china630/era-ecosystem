import {
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { adminApiRoutePermission } from "@/lib/auth/clinic-permissions";
import type { NextResponse } from "next/server";
import type { SatelliteSessionPayload } from "@era/satellite-kit";

type GuardOk = { session: SatelliteSessionPayload; error?: undefined };
type GuardFail = { session?: undefined; error: NextResponse };

/** Permission-mapped admin API gate (Wave 2 — CLINIC_ADMIN matrix applies). */
export async function assertClinicAdminRoute(
  req: Request,
): Promise<GuardOk | GuardFail> {
  const session = await getRouteSession();
  if (!session) return { error: jsonError("Unauthorized", 401) };
  const permission = adminApiRoutePermission(new URL(req.url).pathname);
  if (!permission) return { error: jsonError("Forbidden", 403) };
  const denied = await requireClinicPermission(session, permission);
  if (denied) return { error: denied };
  return { session };
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
