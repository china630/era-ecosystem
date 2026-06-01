import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
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
}
