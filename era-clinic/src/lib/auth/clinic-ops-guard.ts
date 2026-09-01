import {
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import {
  opsApiRoutePermission,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import type { NextResponse } from "next/server";
import type { SatelliteSessionPayload } from "@era/satellite-kit";

type GuardOk = { session: SatelliteSessionPayload; error?: undefined };
type GuardFail = { session?: undefined; error: NextResponse };

/** Staff API gate via opsApiRoutePermission (Wave 3). */
export async function assertOpsApiPermission(
  req: Request,
  permissionOverride?: ClinicPermission,
): Promise<GuardOk | GuardFail> {
  const session = await getRouteSession();
  if (!session) return { error: jsonError("Unauthorized", 401) };
  const permission =
    permissionOverride ??
    opsApiRoutePermission(new URL(req.url).pathname);
  if (!permission) return { error: jsonError("Forbidden", 403) };
  const denied = await requireClinicPermission(session, permission);
  if (denied) return { error: denied };
  return { session };
}
