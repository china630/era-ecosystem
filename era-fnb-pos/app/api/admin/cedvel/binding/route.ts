import { z } from "zod";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  FnbDutyError,
  getBinding,
  upsertBinding,
} from "@/lib/duty-schedules/fnb-duty-schedule.service";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    return jsonOk(await getBinding());
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

const bodySchema = z.object({
  orgUnitIds: z.array(z.string().min(1)).optional(),
  positionIds: z.array(z.string().min(1)).optional(),
  outletIds: z.array(z.string().min(1)).optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const body = bodySchema.parse(await req.json());
    return jsonOk(await upsertBinding(body));
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
