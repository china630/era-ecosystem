import {
  getRouteSession,
  hasClinicAdminRole,
  jsonError,
} from "@/lib/api-utils";
import type { NextResponse } from "next/server";
import type { SatelliteSessionPayload } from "@era/satellite-kit";

type GuardOk = { session: SatelliteSessionPayload; error?: undefined };
type GuardFail = { session?: undefined; error: NextResponse };

export async function assertClinicAdminRead(): Promise<GuardOk | GuardFail> {
  const session = await getRouteSession();
  if (!session) return { error: jsonError("Unauthorized", 401) };
  if (!hasClinicAdminRole(session)) return { error: jsonError("Forbidden", 403) };
  return { session };
}

export async function assertClinicAdminWrite(): Promise<GuardOk | GuardFail> {
  return assertClinicAdminRead();
}
