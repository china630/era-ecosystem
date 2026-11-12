import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { findOpenTicketInOrg, findPosTableInOutlet, moveTicketToTable } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({ tableId: z.string().min(1) });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/move", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_MOVE);
    if (denied) return denied;
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
    await recordFbAudit({ userId: session?.sub, request }, "Ticket", id, "MOVE_TABLE", {
      fromTableId: ticket.tableId,
      toTableId: table.id,
    });
    return sendJson(httpRes, { ticketId: id, tableId: table.id });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
