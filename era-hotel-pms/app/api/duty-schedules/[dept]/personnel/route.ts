import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  DutyScheduleError,
  listPersonnel,
  parseDeptParam,
} from "@/lib/duty-schedules/duty-schedule.service";

type Ctx = { params: Promise<{ dept: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = await ctx.params;
    const units = new URL(req.url).searchParams.getAll("orgUnitId").filter(Boolean);
    return jsonOk(
      await listPersonnel(parseDeptParam(raw), units.length ? units : undefined),
    );
  } catch (err) {
    if (err instanceof DutyScheduleError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return handleRouteError(err);
  }
}
