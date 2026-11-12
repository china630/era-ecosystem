import { NextResponse } from "next/server";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findTicketWithLines, markTicketVoided, voidAllLiveTicketLines } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Cancel an unpaid check. Cashier (pay) or manager (void). Does not refund a closed check. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/void", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.TICKETS_PAY,
      PERMISSIONS.TICKETS_VOID,
    ]);
    if (denied) return denied;

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
      { userId: session?.sub, request },
      "Ticket",
      id,
      "VOID",
      { reason: "till correction" },
    );

    return sendJson(httpRes, { id, status: "VOID", released: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
