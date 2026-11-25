/** Lifted from nest/generated/tickets__id_split.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireCurrentShift } from "@/lib/open-shift";
import { getTicketWithLinesTableOutlet, getTicketWithLinesForSplit, splitLinesToNewTicket, type TicketLine } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const splitSchema = z.object({
  lineIds: z.array(z.string()).min(1),
});


@Controller()
export class TicketsIdSplitController {
  @Post("api/tickets/:id/split")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_SPLIT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const body = splitSchema.parse(httpReq.body);

    const source = await getTicketWithLinesForSplit(id);
    if (!source) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(source.status)) {
      return sendJson(httpRes, { error: "Ticket is not open" }, 400);
    }
    try {
      await requireCurrentShift(source.outletId);
    } catch (err) {
      return sendRouteError(httpRes, err);
    }

    const lineSet = new Set(body.lineIds);
    const toMove = source.lines.filter((l: TicketLine) => lineSet.has(l.id));
    if (toMove.length === 0) {
      return sendJson(httpRes, { error: "No matching lines" }, 400);
    }
    if (toMove.length === source.lines.filter((l: TicketLine) => l.kitchenStatus !== "VOID").length) {
      return sendJson(httpRes, 
        { error: "Leave at least one active line on the original ticket" }, 400);
    }

    const splitTicket = await splitLinesToNewTicket(
      source,
      toMove.map((l: TicketLine) => l.id),
      requestOrganizationId(),
      sessionActorName(session),
    );

    await recalculateTicketTotals(id);
    const updatedSplit = await recalculateTicketTotals(splitTicket.id);
    const updatedSource = await getTicketWithLinesTableOutlet(id);

    return sendJson(httpRes, { source: updatedSource, split: updatedSplit }, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
