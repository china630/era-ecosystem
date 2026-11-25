/** Lifted from nest/generated/admin_cedvel_week.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { describeRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FnbDutyError, copyPreviousWeek, deleteCell, getOrCreateWeek, setWeekStatus, upsertCell } from "@/lib/duty-schedules/fnb-duty-schedule.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function errResponse(err: unknown) {
  if (err instanceof FnbDutyError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  return describeRouteError(err);
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


@Controller()
export class AdminCedvelWeekController {
  @Get("api/admin/cedvel/week")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const weekStart = requestUrl.searchParams.get("weekStart");
    if (!weekStart) {
      return sendJson(httpRes, 
        { error: "weekStart required", code: "WEEK_START_REQUIRED" }, 400);
    }
    return sendJson(httpRes, await getOrCreateWeek(weekStart));
  } catch (err) {
    const described = errResponse(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/cedvel/week")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
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
    const described = errResponse(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
