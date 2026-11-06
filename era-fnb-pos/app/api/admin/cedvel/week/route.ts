import { z } from "zod";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  FnbDutyError,
  copyPreviousWeek,
  deleteCell,
  getOrCreateWeek,
  setWeekStatus,
  upsertCell,
} from "@/lib/duty-schedules/fnb-duty-schedule.service";

function errResponse(err: unknown) {
  if (err instanceof FnbDutyError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  return handleRouteError(err);
}

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const weekStart = new URL(req.url).searchParams.get("weekStart");
    if (!weekStart) {
      return Response.json(
        { error: "weekStart required", code: "WEEK_START_REQUIRED" },
        { status: 400 },
      );
    }
    return jsonOk(await getOrCreateWeek(weekStart));
  } catch (err) {
    return errResponse(err);
  }
}

const upsertSchema = z.object({
  weekStart: z.string().min(8),
  workDate: z.string().min(8),
  globalPersonId: z.string().min(1),
  shiftCode: z.string().min(1),
  personName: z.string().optional(),
  positionName: z.string().nullable().optional(),
  orgUnitId: z.string().nullable().optional(),
  orgUnitName: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  outletId: z.string().nullable().optional(),
  outletName: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const body = await req.json();

    if (body?.action === "deleteCell") {
      const data = z
        .object({ action: z.literal("deleteCell"), cellId: z.string().min(1) })
        .parse(body);
      return jsonOk(await deleteCell(data.cellId));
    }
    if (body?.action === "setStatus") {
      const data = z
        .object({
          action: z.literal("setStatus"),
          weekStart: z.string().min(8),
          status: z.enum(["DRAFT", "APPROVED"]),
        })
        .parse(body);
      return jsonOk(await setWeekStatus(data.weekStart, data.status));
    }
    if (body?.action === "copyPreviousWeek") {
      const data = z
        .object({
          action: z.literal("copyPreviousWeek"),
          weekStart: z.string().min(8),
          replace: z.boolean().optional(),
        })
        .parse(body);
      return jsonOk(
        await copyPreviousWeek(data.weekStart, { replace: data.replace }),
      );
    }

    const data = upsertSchema.parse(body);
    return jsonOk(await upsertCell(data));
  } catch (err) {
    return errResponse(err);
  }
}
