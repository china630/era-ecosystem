/** Lifted from nest/generated/admin_cedvel_personnel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FnbDutyError, listPersonnel } from "@/lib/duty-schedules/fnb-duty-schedule.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminCedvelPersonnelController {
  @Get("api/admin/cedvel/personnel")
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
    const units = requestUrl.searchParams
      .getAll("orgUnitId")
      .filter(Boolean);
    return sendJson(httpRes, await listPersonnel(units.length ? units : undefined));
  } catch (err) {
    if (err instanceof FnbDutyError) {
      return sendJson(httpRes, 
        { error: err.message, code: err.code }, (
        { status: err.status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
