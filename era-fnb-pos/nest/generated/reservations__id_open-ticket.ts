import { NextResponse } from "next/server";
import { createTicketForReservation, findTableReservationWithTableOutlet, findTicketWithTableOutletLines, occupyTableForTicket } from "@/lib/fnb-reservation.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/open-ticket", async (httpReq, httpRes) => {
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

  
    await assertHotelFnbFeature("reservations");
    const denied = denyUnlessPermission(session, PERMISSIONS.RESERVATIONS_OPEN_TICKET);
    if (denied) return denied;

    const { id } = httpReq.params;
    const reservation = await findTableReservationWithTableOutlet(id);
    if (!reservation) {
      return sendJson(httpRes, { error: "Reservation not found" }, 404);
    }

    if (reservation.table.currentTicketId) {
      const existing = await findTicketWithTableOutletLines(
        reservation.table.currentTicketId,
      );
      if (existing && ["OPEN", "HELD"].includes(existing.status)) {
        return sendJson(httpRes, existing);
      }
    }

    const ticket = await createTicketForReservation({
      organizationId: requestOrganizationId(),
      outletId: reservation.table.outletId,
      tableId: reservation.tableId,
      covers: reservation.partySize,
      guestName: reservation.guestName,
      openedByName: sessionActorName(session),
    });

    await occupyTableForTicket(reservation.tableId, ticket.id);

    return sendJson(httpRes, ticket, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
