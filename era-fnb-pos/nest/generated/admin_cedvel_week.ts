import { z } from "zod";
import { handleRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FnbDutyError, copyPreviousWeek, deleteCell, getOrCreateWeek, setWeekStatus, upsertCell } from "@/lib/duty-schedules/fnb-duty-schedule.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function errResponse(err: unknown) {
  if (err instanceof FnbDutyError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  return handleRouteError(err);
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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/cedvel/week", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const weekStart = new URL(req.url).searchParams.get("weekStart");
    if (!weekStart) {
      return sendJson(httpRes, 
        { error: "weekStart required", code: "WEEK_START_REQUIRED" }, 400);
    }
    return sendJson(httpRes, await getOrCreateWeek(weekStart));
  } catch (err) {
    return errResponse(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/cedvel/week", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return denied;
    const body = httpReq.body;

    if (body?.action === "deleteCell") {
      const data = z
        .object({ action: z.literal("deleteCell"), cellId: z.string().min(1) })
        .parse(body);
      return sendJson(httpRes, await deleteCell(data.cellId));
    }
    if (body?.action === "setStatus") {
      const data = z
        .object({
          action: z.literal("setStatus"),
          weekStart: z.string().min(8),
          status: z.enum(["DRAFT", "APPROVED"]),
        })
        .parse(body);
      return sendJson(httpRes, await setWeekStatus(data.weekStart, data.status));
    }
    if (body?.action === "copyPreviousWeek") {
      const data = z
        .object({
          action: z.literal("copyPreviousWeek"),
          weekStart: z.string().min(8),
          replace: z.boolean().optional(),
        })
        .parse(body);
      return sendJson(httpRes, 
        await copyPreviousWeek(data.weekStart, { replace: data.replace }),
      );
    }

    const data = upsertSchema.parse(body);
    return sendJson(httpRes, await upsertCell(data));
  } catch (err) {
    return errResponse(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
