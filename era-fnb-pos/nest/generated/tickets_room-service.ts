import { z } from "zod";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { createRoomServiceTicket } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  roomNumber: z.string().min(1),
  guestName: z.string().optional(),
  outletCode: z.string().min(1),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** Room service ticket — no table; routes to KDS via standard fire flow. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/room-service", async (httpReq, httpRes) => {
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

  
    await assertHotelFnbFeature("room-service");
    const denied = denyUnlessPermission(session, PERMISSIONS.ROOM_SERVICE);
    if (denied) return denied;

    const body = schema.parse(httpReq.body);
    const outlet = await ensureOutletByCode(body.outletCode);
    const cookieOutlet = await getSelectedOutletId();
    const outletId = cookieOutlet && cookieOutlet === outlet.id ? outlet.id : outlet.id;

    const subtotal = body.lines.reduce((s, l) => s + l.qty * l.unitPriceAzn, 0);
    const ticket = await createRoomServiceTicket(
      requestOrganizationId(),
      outletId,
      body.guestName ?? `Room ${body.roomNumber}`,
      sessionActorName(session),
      body.lines,
      subtotal,
    );

    return sendJson(httpRes, ticket, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
