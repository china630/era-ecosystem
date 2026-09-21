import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertFnbEntitled();
    await assertHotelFnbFeature("reservations");
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.RESERVATIONS_OPEN_TICKET);
    if (denied) return denied;

    const { id } = await params;
    const reservation = await prisma.tableReservation.findUnique({
      where: { id },
      include: { table: { include: { outlet: true } } },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.table.currentTicketId) {
      const existing = await prisma.ticket.findUnique({
        where: { id: reservation.table.currentTicketId },
        include: { table: true, outlet: true, lines: true },
      });
      if (existing && ["OPEN", "HELD"].includes(existing.status)) {
        return NextResponse.json(existing);
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: requestOrganizationId(),
        outletId: reservation.table.outletId,
        tableId: reservation.tableId,
        covers: reservation.partySize,
        guestName: reservation.guestName,
        subtotalAzn: 0,
        totalAzn: 0,
      },
      include: { table: true, outlet: true, lines: true },
    });

    await prisma.posTable.update({
      where: { id: reservation.tableId },
      data: { status: "OCCUPIED", currentTicketId: ticket.id },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
