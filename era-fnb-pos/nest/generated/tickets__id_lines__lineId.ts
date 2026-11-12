import { NextResponse } from "next/server";
import { z } from "zod";
import { attachDayNos, recalculateTicketTotals, voidTicketIfNoLiveLines } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";
import { requireOpenShift } from "@/lib/open-shift";
import { findTicketById, findTicketLineOnTicket, getTicketWithLinesAndTable, updateTicketLineQuantity, voidTicketLineTillCorrection } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const qtySchema = z.object({
  qty: z.number().int().min(0),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/tickets/:id/lines/:lineId", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_LINES);
    if (denied) return denied;

    const { id, lineId } = httpReq.params;
    const body = qtySchema.parse(httpReq.body);

    const ticket = await findTicketById(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Ticket is not open" }, 400);
    }
    await requireOpenShift(ticket.outletId);

    const line = await findTicketLineOnTicket(id, lineId);
    if (!line || line.kitchenStatus === "VOID") {
      return sendJson(httpRes, { error: "Line not found" }, 404);
    }

    if (body.qty > line.qty && line.menuItemId) {
      await assertMenuItemNotSoldOut({
        outletId: ticket.outletId,
        menuItemId: line.menuItemId,
      });
    }

    const fired = line.kitchenStatus !== "NEW";
    if (fired && body.qty < line.qty && (!session || !sessionHasFnbPermission(session, PERMISSIONS.TICKETS_VOID))) {
      return sendJson(httpRes, 
        { error: "Fired line requires void permission", code: "FNB_FIRED_LINE" }, 403);
    }

    if (body.qty === 0) {
      await voidTicketLineTillCorrection(lineId);
      await recordFbAudit(
        { userId: session?.sub, request },
        "TicketLine",
        lineId,
        "VOID",
        { ticketId: id, reason: "till correction", lineName: line.description },
      );
    } else {
      await updateTicketLineQuantity(lineId, body.qty);
    }

    const updated = await recalculateTicketTotals(id);
    const released = await voidTicketIfNoLiveLines(id);
    const fresh = await getTicketWithLinesAndTable(id);
    const [withDay] = await attachDayNos([fresh ?? { ...updated, organizationId: ticket.organizationId }]);
    return sendJson(httpRes, { ...(withDay ?? fresh ?? updated), released });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
