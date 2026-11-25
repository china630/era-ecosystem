/** Lifted from nest/generated/tickets__id_move.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findOpenTicketInOrg, findPosTableInOutlet, moveTicketToTable } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({ tableId: z.string().min(1) });


@Controller()
export class TicketsIdMoveController {
  @Post("api/tickets/:id/move")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_MOVE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const ticket = await findOpenTicketInOrg(id, organizationId);
    if (!ticket || !["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Open ticket required" }, 400);
    }
    const table = await findPosTableInOutlet(body.tableId, ticket.outletId);
    if (!table) return sendJson(httpRes, { error: "Table is not on this outlet" }, 404);
    if (table.currentTicketId && table.currentTicketId !== id) {
      return sendJson(httpRes, { error: "Table already has an open check" }, 409);
    }
    await moveTicketToTable(id, table.id);
    await recordFbAudit({ userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } }, "Ticket", id, "MOVE_TABLE", {
      fromTableId: ticket.tableId,
      toTableId: table.id,
    });
    return sendJson(httpRes, { ticketId: id, tableId: table.id });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
