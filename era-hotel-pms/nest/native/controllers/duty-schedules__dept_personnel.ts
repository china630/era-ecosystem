/** Lifted from era-hotel-pms/nest/generated/duty-schedules__dept_personnel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { DutyScheduleError, listPersonnel, parseDeptParam } from "@/lib/duty-schedules/duty-schedule.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ dept: string }> };


@Controller()
export class DutySchedulesDeptPersonnelController {
  @Get("api/duty-schedules/:dept/personnel")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = httpReq.params;
    const units = requestUrl.searchParams.getAll("orgUnitId").filter(Boolean);
    return sendJson(httpRes, 
      await listPersonnel(parseDeptParam(raw), units.length ? units : undefined),
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
