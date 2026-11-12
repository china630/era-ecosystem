import { z } from "zod";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { assertTicketCreateQuota } from "@/lib/fnb-quota";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { attachDayNos } from "@/lib/ticket-helpers";
import { requireCurrentShift } from "@/lib/open-shift";
import { createTicketWithLines, listOpenHeldTickets, occupyTableForTicket } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  tableId: z.string().optional(),
  beoId: z.string().optional(),
  serviceChannel: z.enum(["DINE_IN", "ROOM_SERVICE", "WALK_IN", "TAKEAWAY"]).optional(),
  walkInLabel: z.string().max(120).optional(),
  covers: z.number().int().positive().optional(),
  guestName: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
        menuItemPlu: z.string().optional(),
      }),
    )
    .optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/tickets", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return denied;
    const url = new URL(request.url);
    const beoId = url.searchParams.get("beoId");
    const serviceChannel = url.searchParams.get("serviceChannel");
    const outletIdParam = url.searchParams.get("outletId");
    const selectedOutlet = outletIdParam ?? (await getSelectedOutletId());

    const tickets = await listOpenHeldTickets({
      ...(beoId ? { beoId } : {}),
      ...(serviceChannel ? { serviceChannel } : {}),
      ...(selectedOutlet ? { outletId: selectedOutlet } : {}),
    });
    return sendJson(httpRes, await attachDayNos(tickets));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/tickets", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OPEN);
    if (denied) return denied;

    const orgId = requestOrganizationId();
    assertTicketCreateQuota(orgId);

    const body = createSchema.parse(httpReq.body);
    if (body.beoId || body.serviceChannel === "ROOM_SERVICE") {
      await assertHotelFnbFeature("hotel-ticket");
    }
    const outlet = await resolveOpsOutlet(body.outletCode);
    const { outletAllowsTill } = await import("@/lib/outlet-capabilities");
    if (!outletAllowsTill(outlet)) {
      return sendJson(httpRes, { error: "Outlet has no till capability — cannot open ticket" }, 400);
    }
    await requireCurrentShift(outlet.id);

    const lines = body.lines ?? [];
    for (const l of lines) {
      if (l.menuItemPlu) {
        await assertMenuItemNotSoldOut({ outletId: outlet.id, plu: l.menuItemPlu });
      }
    }
  const subtotal = lines.reduce(
    (s, l) => s + l.qty * l.unitPriceAzn,
    0,
  );

  const channel =
    body.serviceChannel ??
    (body.walkInLabel ? "WALK_IN" : body.tableId ? "DINE_IN" : undefined);

  const ticket = await createTicketWithLines({
    organizationId: requestOrganizationId(),
    outletId: outlet.id,
    tableId: body.tableId,
    covers: body.covers ?? 1,
    guestName: body.guestName,
    serviceChannel: channel,
    walkInLabel: body.walkInLabel,
    beoId: body.beoId,
    openedByName: sessionActorName(session),
    waiterLabel: sessionActorName(session),
    subtotalAzn: subtotal,
    lines,
  });

  if (body.tableId && lines.length > 0) {
    await occupyTableForTicket(body.tableId, ticket.id);
  }

  const [withDay] = await attachDayNos([ticket]);
  return sendJson(httpRes, withDay ?? ticket, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
