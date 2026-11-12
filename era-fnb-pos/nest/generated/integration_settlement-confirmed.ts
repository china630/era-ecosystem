import { NextResponse } from "next/server";
import { z } from "zod";
import { SATELLITE_FB_SALE_COMPLETED } from "@era/contracts";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { assertFbRevenueChannel } from "@/lib/fb-finance-events";
import { enterRequestTenant } from "@/lib/request-organization";
import { closeTicketOnHubSettlement, findTicketForHubSettlement, updateTicketSettlementPendingId } from "@/lib/ticket-pay.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  /** Hub always sends sourceOrgId — required for SHARED tenant enter before data access. */
  organizationId: z.string().min(1),
});

function verifyBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/settlement-confirmed", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!verifyBridge(request)) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }

    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);

    const ticket = await findTicketForHubSettlement(body.sourceRef);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }

    if (ticket.status === "CLOSED") {
      return sendJson(httpRes, { ok: true, alreadyClosed: true });
    }

    const storedPendingIds = ticket.settlementPendingId?.trim() ?? "";
    if (storedPendingIds.startsWith("[")) {
      const parsed = JSON.parse(storedPendingIds) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const left = ids.filter((id) => id !== body.pendingId);
      if (left.length > 0) {
        await updateTicketSettlementPendingId(ticket.id, JSON.stringify(left));
        return sendJson(httpRes, { ok: true, waiting: left.length });
      }
    }

    // Fail-closed before CLOSE — hub settle completes money path (sale emit stays local-cashier only).
    await assertFbRevenueChannel(SATELLITE_FB_SALE_COMPLETED);

    const closedAt = new Date();
    await closeTicketOnHubSettlement({
      ticketId: ticket.id,
      closedAt,
      outletId: ticket.outletId,
      pendingId: body.pendingId,
      fiscalReceiptId: body.fiscalReceiptId ?? null,
    });
    await releaseTableForTicket(ticket.id, ticket.tableId);

    return sendJson(httpRes, { ok: true, ticketId: ticket.id, status: "CLOSED" });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
