import { NextResponse } from "next/server";
import { z } from "zod";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";
import { requireOpenShift } from "@/lib/open-shift";
import { addTicketLines, findMenuItemIdByPlu, findTicketById, listTicketLines } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  description: z.string().min(1),
  qty: z.number().int().positive().default(1),
  unitPriceAzn: z.number().nonnegative(),
  menuItemPlu: z.string().optional(),
  notes: z.string().optional(),
});

const createSchema = z.union([lineSchema, z.array(lineSchema)]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/lines", async (httpReq, httpRes) => {
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

  const { id } = httpReq.params;
  const ticket = await findTicketById(id);
  if (!ticket) {
    return sendJson(httpRes, { error: "Ticket not found" }, 404);
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return sendJson(httpRes, 
      { error: "Ticket is not open for new lines" }, 400);
  }
  await requireOpenShift(ticket.outletId);

  const parsed = createSchema.parse(httpReq.body);
  const items = Array.isArray(parsed) ? parsed : [parsed];

  for (const item of items) {
    if (item.menuItemPlu) {
      const menuItemId = await findMenuItemIdByPlu(item.menuItemPlu);
      if (menuItemId) {
        await assertMenuItemNotSoldOut({
          outletId: ticket.outletId,
          menuItemId,
          plu: item.menuItemPlu,
        });
      }
    }
  }

  await addTicketLines(id, ticket.organizationId, items);

  const updated = await recalculateTicketTotals(id);
  const lines = await listTicketLines(id);

  return sendJson(httpRes, { ...updated, lines }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
