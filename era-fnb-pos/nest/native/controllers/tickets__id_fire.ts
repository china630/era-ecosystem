/** Lifted from nest/generated/tickets__id_fire.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { findTicketById, fireAllNewLinesOnTicket, getTicketWithLinesTableOutlet } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class TicketsIdFireController {
  @Post("api/tickets/:id/fire")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_FIRE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const ticket = await findTicketById(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, 
        { error: "Ticket is not open for fire" }, 400);
    }

    const result = await fireAllNewLinesOnTicket(id);

    const updated = await getTicketWithLinesTableOutlet(id);

    return sendJson(httpRes, {
      ticket: updated,
      firedCount: result.count,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
