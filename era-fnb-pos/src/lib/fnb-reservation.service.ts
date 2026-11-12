import { prisma } from "@/lib/prisma";

export function listTableReservationsForDay(dayStart: Date, dayEnd: Date) {
  return prisma.tableReservation.findMany({
    where: { startAt: { gte: dayStart, lt: dayEnd } },
    include: { table: { select: { code: true } } },
    orderBy: { startAt: "asc" },
  });
}

export function createTableReservation(data: {
  tableId: string;
  startAt: Date;
  endAt: Date;
  guestName?: string;
  partySize: number;
}) {
  return prisma.tableReservation.create({
    data: {
      tableId: data.tableId,
      startAt: data.startAt,
      endAt: data.endAt,
      guestName: data.guestName,
      partySize: data.partySize,
    },
    include: { table: { select: { code: true } } },
  });
}

export function findTableReservationWithTableOutlet(id: string) {
  return prisma.tableReservation.findUnique({
    where: { id },
    include: { table: { include: { outlet: true } } },
  });
}

export function findTicketWithTableOutletLines(ticketId: string) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { table: true, outlet: true, lines: true },
  });
}

export function createTicketForReservation(data: {
  organizationId: string;
  outletId: string;
  tableId: string;
  covers: number;
  guestName: string | null;
  openedByName: string | null;
}) {
  return prisma.ticket.create({
    data: {
      organizationId: data.organizationId,
      outletId: data.outletId,
      tableId: data.tableId,
      covers: data.covers,
      guestName: data.guestName,
      openedByName: data.openedByName,
      subtotalAzn: 0,
      totalAzn: 0,
    },
    include: { table: true, outlet: true, lines: true },
  });
}

export function occupyTableForTicket(tableId: string, ticketId: string) {
  return prisma.posTable.update({
    where: { id: tableId },
    data: { status: "OCCUPIED", currentTicketId: ticketId },
  });
}
