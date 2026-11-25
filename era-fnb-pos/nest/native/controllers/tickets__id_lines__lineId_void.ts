/** Lifted from nest/generated/tickets__id_lines__lineId_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findTicketById, findTicketLineOnTicket, listTicketLines, voidTicketLineWithReason } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const voidSchema = z.object({
  reason: z.string().min(1),
});


@Controller()
export class TicketsIdLinesLineIdVoidController {
  @Post("api/tickets/:id/lines/:lineId/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_VOID);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id, lineId } = httpReq.params;
    const body = voidSchema.parse(httpReq.body);

    const ticket = await findTicketById(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Ticket is not open" }, 400);
    }

    const line = await findTicketLineOnTicket(id, lineId);
    if (!line) {
      return sendJson(httpRes, { error: "Line not found" }, 404);
    }
    if (line.kitchenStatus === "VOID") {
      return sendJson(httpRes, { error: "Line already void" }, 400);
    }

    await voidTicketLineWithReason(lineId, body.reason);

    await recordFbAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "TicketLine",
      lineId,
      "VOID",
      { ticketId: id, reason: body.reason, lineName: line.description },
    );

    const updated = await recalculateTicketTotals(id);
    const lines = await listTicketLines(id);

    return sendJson(httpRes, { ticket: { ...updated, lines }, reason: body.reason });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
