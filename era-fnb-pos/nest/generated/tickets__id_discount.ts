import { NextResponse } from "next/server";
import { z } from "zod";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findTicketById, setTicketDiscountPercent } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const discountSchema = z.object({
  discountPercent: z.number().min(0).max(100),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/discount", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_DISCOUNT);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = discountSchema.parse(httpReq.body);

    const ticket = await findTicketById(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Ticket is closed" }, 400);
    }

    const before = Number(ticket.discountPercent ?? 0);
    await setTicketDiscountPercent(id, body.discountPercent);
    const updated = await recalculateTicketTotals(id);
    await recordFbAudit(
      { userId: session?.sub, request },
      "Ticket",
      id,
      "DISCOUNT",
      {
        discountPercent: { from: before, to: body.discountPercent },
        totalAzn: updated ? Number(updated.totalAzn) : undefined,
      },
    );
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
