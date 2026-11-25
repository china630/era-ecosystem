/** Lifted from nest/generated/reservations__id_open-ticket.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { createTicketForReservation, findTableReservationWithTableOutlet, findTicketWithTableOutletLines, occupyTableForTicket } from "@/lib/fnb-reservation.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdOpenTicketController {
  @Post("api/reservations/:id/open-ticket")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    await assertHotelFnbFeature("reservations");
    const denied = denyUnlessPermission(session, PERMISSIONS.RESERVATIONS_OPEN_TICKET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
