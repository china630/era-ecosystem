import {
  getSatelliteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import {
  opsApiRoutePermissions,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import { sessionHasAnyClinicPermission } from "@/lib/auth/clinic-permission-check";
import type { ClinicJson } from "@/lib/clinic-json";
import type { SatelliteStaffSessionPayload } from "@era/satellite-kit";

type GuardOk = { session: SatelliteStaffSessionPayload; error?: undefined };
type GuardFail = { session?: undefined; error: ClinicJson };

/** Staff API gate via opsApiRoutePermission (Wave 3). */
export async function assertOpsApiPermission(
  req: { url: string; method?: string },
  permissionOverride?: ClinicPermission,
): Promise<GuardOk | GuardFail> {
  const session = await getSatelliteSession();
  if (!session) return { error: jsonError("Unauthorized", 401) };
  if (permissionOverride) {
    const denied = await requireClinicPermission(session, permissionOverride);
    if (denied) return { error: denied };
    return { session };
  }
  const path = new URL(req.url).pathname;
  const allowed = opsApiRoutePermissions(path, req.method ?? "GET");
  if (!allowed.length) {
    return { error: jsonError("Forbidden", 403, { code: "FORBIDDEN" }) };
  }
  if (allowed.length === 1) {
    const denied = await requireClinicPermission(session, allowed[0]!);
    if (denied) return { error: denied };
    return { session };
  }
  if (!sessionHasAnyClinicPermission(session, allowed)) {
    return { error: jsonError("Forbidden", 403, { code: "FORBIDDEN" }) };
  }
  return { session };
}
