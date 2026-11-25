/** Lifted from nest/generated/tickets__id_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findTicketWithLines, markTicketVoided, voidAllLiveTicketLines } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Cancel an unpaid check. Cashier (pay) or manager (void). Does not refund a closed check. */


@Controller()
export class TicketsIdVoidController {
  @Post("api/tickets/:id/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.TICKETS_PAY,
      PERMISSIONS.TICKETS_VOID,
    ]);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const ticket = await findTicketWithLines(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Ticket is not open" }, 400);
    }

    await voidAllLiveTicketLines(id);
    await markTicketVoided(id);
    await releaseTableForTicket(id, ticket.tableId);
    await recordFbAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Ticket",
      id,
      "VOID",
      { reason: "till correction" },
    );

    return sendJson(httpRes, { id, status: "VOID", released: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
