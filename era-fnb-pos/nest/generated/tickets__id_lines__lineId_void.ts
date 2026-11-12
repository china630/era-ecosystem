import { NextResponse } from "next/server";
import { z } from "zod";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findTicketById, findTicketLineOnTicket, listTicketLines, voidTicketLineWithReason } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const voidSchema = z.object({
  reason: z.string().min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/lines/:lineId/void", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_VOID);
    if (denied) return denied;

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
      { userId: session?.sub, request },
      "TicketLine",
      lineId,
      "VOID",
      { ticketId: id, reason: body.reason, lineName: line.description },
    );

    const updated = await recalculateTicketTotals(id);
    const lines = await listTicketLines(id);

    return sendJson(httpRes, { ticket: { ...updated, lines }, reason: body.reason });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
