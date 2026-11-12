import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireCurrentShift } from "@/lib/open-shift";
import { getTicketWithLinesTableOutlet, getTicketWithLinesForSplit, splitLinesToNewTicket, type TicketLine } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const splitSchema = z.object({
  lineIds: z.array(z.string()).min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/split", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_SPLIT);
    if (denied) return denied;

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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
