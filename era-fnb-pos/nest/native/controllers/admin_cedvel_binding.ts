/** Lifted from nest/generated/admin_cedvel_binding.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FnbDutyError, getBinding, upsertBinding } from "@/lib/duty-schedules/fnb-duty-schedule.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  orgUnitIds: z.array(z.string().min(1)).optional(),
  positionIds: z.array(z.string().min(1)).optional(),
  outletIds: z.array(z.string().min(1)).optional(),
});


@Controller()
export class AdminCedvelBindingController {
  @Get("api/admin/cedvel/binding")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    return sendJson(httpRes, await getBinding());
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

  @Put("api/admin/cedvel/binding")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_ROSTER);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, await upsertBinding(body));
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
