import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { serialize } from "@/lib/serialize";
import { getSatelliteSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  DutyScheduleError,
  copyPreviousWeek,
  deleteCell,
  getOrCreateWeek,
  parseDeptParam,
  setWeekStatus,
  upsertCell,
} from "@/lib/duty-schedules/duty-schedule.service";

type Ctx = { params: Promise<{ dept: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = await ctx.params;
    const weekStart = new URL(req.url).searchParams.get("weekStart");
    if (!weekStart) {
      return Response.json(
        { error: "weekStart required", code: "WEEK_START_REQUIRED" },
        { status: 400 },
      );
    }
    return jsonOk(serialize(await getOrCreateWeek(parseDeptParam(raw), weekStart)));
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

const upsertSchema = z.object({
  action: z.literal("upsertCell").optional(),
  weekStart: z.string().min(8),
  workDate: z.string().min(8),
  axisId: z.string().uuid(),
  globalPersonId: z.string().min(1),
  shiftCode: z.string().min(1),
  personName: z.string().optional(),
  orgUnitId: z.string().nullable().optional(),
  orgUnitName: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  positionName: z.string().nullable().optional(),
});

const deleteSchema = z.object({
  action: z.literal("deleteCell"),
  cellId: z.string().uuid(),
});

const statusSchema = z.object({
  action: z.literal("setStatus"),
  weekStart: z.string().min(8),
  status: z.enum(["DRAFT", "APPROVED"]),
});

const copySchema = z.object({
  action: z.literal("copyPreviousWeek"),
  weekStart: z.string().min(8),
  replace: z.boolean().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = await ctx.params;
    const dept = parseDeptParam(raw);
    const body = await req.json();

    if (body?.action === "deleteCell") {
      const data = deleteSchema.parse(body);
      return jsonOk(await deleteCell(data.cellId));
    }
    if (body?.action === "setStatus") {
      const data = statusSchema.parse(body);
      return jsonOk(serialize(await setWeekStatus(dept, data.weekStart, data.status)));
    }
    if (body?.action === "copyPreviousWeek") {
      const data = copySchema.parse(body);
      return jsonOk(
        serialize(
          await copyPreviousWeek(dept, data.weekStart, { replace: data.replace }),
        ),
      );
    }

    const data = upsertSchema.parse(body);
    return jsonOk(
      serialize(
        await upsertCell({
          dept,
          weekStart: data.weekStart,
          workDate: data.workDate,
          axisId: data.axisId,
          globalPersonId: data.globalPersonId,
          shiftCode: data.shiftCode,
          personName: data.personName,
          orgUnitId: data.orgUnitId,
          orgUnitName: data.orgUnitName,
          positionId: data.positionId,
          positionName: data.positionName,
        }),
      ),
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
