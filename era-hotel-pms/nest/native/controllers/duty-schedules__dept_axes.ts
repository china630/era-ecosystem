/** Lifted from era-hotel-pms/nest/generated/duty-schedules__dept_axes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { DutyScheduleError, listAxes, parseDeptParam, upsertAxis } from "@/lib/duty-schedules/duty-schedule.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ dept: string }> };



const bodySchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  kind: z.string().min(1).max(40).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class DutySchedulesDeptAxesController {
  @Get("api/duty-schedules/:dept/axes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = httpReq.params;
    return sendJson(httpRes, await listAxes(parseDeptParam(raw)));
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

  @Post("api/duty-schedules/:dept/axes")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    const { dept: raw } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, await upsertAxis(parseDeptParam(raw), body));
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
