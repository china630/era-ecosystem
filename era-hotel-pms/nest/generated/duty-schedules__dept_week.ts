import { z } from "zod";
import { serialize } from "@/lib/serialize";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { DutyScheduleError, copyPreviousWeek, deleteCell, getOrCreateWeek, parseDeptParam, setWeekStatus, upsertCell } from "@/lib/duty-schedules/duty-schedule.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type Ctx = { params: Promise<{ dept: string }> };



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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/duty-schedules/:dept/week", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = httpReq.params;
    const weekStart = new URL(req.url).searchParams.get("weekStart");
    if (!weekStart) {
      return sendJson(httpRes, 
        { error: "weekStart required", code: "WEEK_START_REQUIRED" }, 400);
    }
    return sendJson(httpRes, serialize(await getOrCreateWeek(parseDeptParam(raw), weekStart)));
  } catch (err) {
    if (err instanceof DutyScheduleError) {
      return sendJson(httpRes, 
        { error: err.message, code: err.code }, (
        { status: err.status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/duty-schedules/:dept/week", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = httpReq.params;
    const dept = parseDeptParam(raw);
    const body = httpReq.body;

    if (body?.action === "deleteCell") {
      const data = deleteSchema.parse(body);
      return sendJson(httpRes, await deleteCell(data.cellId));
    }
    if (body?.action === "setStatus") {
      const data = statusSchema.parse(body);
      return sendJson(httpRes, serialize(await setWeekStatus(dept, data.weekStart, data.status)));
    }
    if (body?.action === "copyPreviousWeek") {
      const data = copySchema.parse(body);
      return sendJson(httpRes, 
        serialize(
          await copyPreviousWeek(dept, data.weekStart, { replace: data.replace }),
        ),
      );
    }

    const data = upsertSchema.parse(body);
    return sendJson(httpRes, 
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
      return sendJson(httpRes, 
        { error: err.message, code: err.code }, (
        { status: err.status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
