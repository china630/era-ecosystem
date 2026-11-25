/** Lifted from nest/generated/labor_clock.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createPinClockEvent, findStaffRosterByStaffCode, pinMatches } from "@/lib/labor-pin";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  staffCode: z.string().min(1),
  pin: z.string().min(4).max(8),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]).default("CLOCK_IN"),
});


@Controller()
export class LaborClockController {
  @Post("api/labor/clock")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const staff = await findStaffRosterByStaffCode(body.staffCode);
    if (!staff || !staff.active) return sendJson(httpRes, { error: "Staff not found" }, 404);
    if (!pinMatches(staff.pinHash, body.pin)) return sendJson(httpRes, { error: "Invalid PIN" }, 401);
    const event = await createPinClockEvent({
      staffCode: body.staffCode,
      eventType: body.eventType,
    });
    return sendJson(httpRes, event, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
