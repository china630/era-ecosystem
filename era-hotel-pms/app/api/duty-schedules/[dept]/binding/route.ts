import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  DutyScheduleError,
  getBinding,
  parseDeptParam,
  upsertBinding,
} from "@/lib/duty-schedules/duty-schedule.service";

type Ctx = { params: Promise<{ dept: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = await ctx.params;
    return jsonOk(await getBinding(parseDeptParam(raw)));
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

const bodySchema = z.object({
  orgUnitIds: z.array(z.string().min(1)).optional(),
  positionIds: z.array(z.string().min(1)).optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    return jsonOk(await upsertBinding(parseDeptParam(raw), body));
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
