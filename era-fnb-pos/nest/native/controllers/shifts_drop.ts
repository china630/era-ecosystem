/** Lifted from nest/generated/shifts_drop.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { createPosCashDrop, resolvePosShiftForOps } from "@/lib/shift.service";
import { cashDrawerForShift } from "@/lib/cash-drawer";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const dropSchema = z.object({
  shiftId: z.string().optional(),
  amountAzn: z.number().positive(),
  note: z.string().max(120).optional(),
});


@Controller()
export class ShiftsDropController {
  @Post("api/shifts/drop")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = dropSchema.parse(httpReq.body);
    const shift = await resolvePosShiftForOps(body.shiftId);
    if (!shift || shift.status !== "OPEN") return sendJson(httpRes, { error: "Open shift not found" }, 404);
    await createPosCashDrop({
      organizationId: requestOrganizationId(),
      shiftId: shift.id,
      amountAzn: body.amountAzn,
      note: body.note?.trim() || null,
    });
    return sendJson(httpRes, await cashDrawerForShift(shift));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
