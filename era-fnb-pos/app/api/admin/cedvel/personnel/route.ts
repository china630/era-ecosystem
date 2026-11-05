import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  FnbDutyError,
  listPersonnel,
} from "@/lib/duty-schedules/fnb-duty-schedule.service";

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const units = new URL(req.url).searchParams
      .getAll("orgUnitId")
      .filter(Boolean);
    return jsonOk(await listPersonnel(units.length ? units : undefined));
  } catch (err) {
    if (err instanceof FnbDutyError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return handleRouteError(err);
  }
}
