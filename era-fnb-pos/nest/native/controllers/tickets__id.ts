/** Lifted from nest/generated/tickets__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { attachDayNos } from "@/lib/ticket-helpers";
import { findTicketById, getTicketDetailById, patchTicketRoomGuest } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  roomChargeReservationId: z.string().nullable().optional(),
  roomNumber: z.string().optional(),
  guestName: z.string().nullable().optional(),
});


@Controller()
export class TicketsIdController {
  @Get("api/tickets/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const { id } = httpReq.params;
    const ticket = await getTicketDetailById(id);
    if (!ticket) return sendJson(httpRes, { error: "Ticket not found" }, 404);
    const [withDay] = await attachDayNos([ticket]);
    return sendJson(httpRes, withDay ?? ticket);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/tickets/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const ticket = await findTicketById(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }

    const updated = await patchTicketRoomGuest(id, body, {
      roomChargeReservationId: ticket.roomChargeReservationId,
      guestName: ticket.guestName,
      roomNumberLabel: ticket.roomNumberLabel,
    });

    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
