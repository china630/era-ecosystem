import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCatalog } from "@/lib/duty-schedules/duty-schedule.service";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    return jsonOk(await listCatalog());
  } catch (err) {
    return handleRouteError(err);
  }
}
