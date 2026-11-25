/** Lifted from nest/generated/tickets__id_fire-course.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fireCourseLinesOnTicket, getTicketLinesOnly } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  courseNumber: z.number().int().positive(),
  delayMinutes: z.number().int().nonnegative().optional(),
});


@Controller()
export class TicketsIdFireCourseController {
  @Post("api/tickets/:id/fire-course")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_FIRE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const fireAt = body.delayMinutes
      ? new Date(Date.now() + body.delayMinutes * 60_000)
      : new Date();

    const result = await fireCourseLinesOnTicket(id, body.courseNumber, fireAt);

    const ticket = await getTicketLinesOnly(id);
    return sendJson(httpRes, { ticket, firedCount: result.count, fireAt });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
