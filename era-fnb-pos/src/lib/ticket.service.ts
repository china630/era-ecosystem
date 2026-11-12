import type { Prisma, TicketLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const openTicketListInclude = {
  table: true,
  lines: true,
  outlet: { select: { code: true, name: true } },
} satisfies Prisma.TicketInclude;

export type OpenTicketListFilters = {
  beoId?: string;
  serviceChannel?: string;
  outletId?: string;
};

export async function listOpenHeldTickets(filters: OpenTicketListFilters) {
  return prisma.ticket.findMany({
    where: {
      status: { in: ["OPEN", "HELD"] },
      ...(filters.beoId ? { beoId: filters.beoId } : {}),
      ...(filters.serviceChannel ? { serviceChannel: filters.serviceChannel } : {}),
      ...(filters.outletId ? { outletId: filters.outletId } : {}),
    },
    include: openTicketListInclude,
    orderBy: { openedAt: "desc" },
    take: 100,
  });
}

export async function findMenuItemIdByPlu(plu: string): Promise<string | undefined> {
  const menuItem = await prisma.menuItem.findFirst({ where: { plu } });
  return menuItem?.id;
}

export type CreateTicketLineInput = {
  description: string;
  qty: number;
  unitPriceAzn: number;
  menuItemPlu?: string;
};

export type CreateTicketInput = {
  organizationId: string;
  outletId: string;
  tableId?: string;
  covers: number;
  guestName?: string;
  serviceChannel?: "DINE_IN" | "ROOM_SERVICE" | "WALK_IN" | "TAKEAWAY";
  walkInLabel?: string;
  beoId?: string;
  openedByName?: string | null;
  waiterLabel?: string | null;
  subtotalAzn: number;
  lines: CreateTicketLineInput[];
};

export async function createTicketWithLines(input: CreateTicketInput) {
  const lines = await Promise.all(
    input.lines.map(async (l) => {
      let menuItemId: string | undefined;
      if (l.menuItemPlu) {
        menuItemId = await findMenuItemIdByPlu(l.menuItemPlu);
      }
      return {
        organizationId: input.organizationId,
        description: l.description,
        qty: l.qty,
        unitPriceAzn: l.unitPriceAzn,
        menuItemId,
      };
    }),
  );

  return prisma.ticket.create({
    data: {
      organizationId: input.organizationId,
      outletId: input.outletId,
      tableId: input.tableId,
      covers: input.covers,
      guestName: input.guestName,
      serviceChannel: input.serviceChannel,
      walkInLabel: input.walkInLabel,
      beoId: input.beoId,
      openedByName: input.openedByName,
      waiterLabel: input.waiterLabel,
      subtotalAzn: input.subtotalAzn,
      totalAzn: input.subtotalAzn,
      lines: { create: lines },
    },
    include: { lines: true, table: true },
  });
}

export async function occupyTableForTicket(tableId: string, ticketId: string) {
  await prisma.posTable.update({
    where: { id: tableId },
    data: { status: "OCCUPIED", currentTicketId: ticketId },
  });
}

const ticketDetailInclude = {
  lines: true,
  table: true,
  shift: { select: { openedAt: true } },
  outlet: { select: { code: true, name: true } },
} satisfies Prisma.TicketInclude;

export async function getTicketDetailById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: ticketDetailInclude,
  });
}

export async function findTicketById(id: string) {
  return prisma.ticket.findUnique({ where: { id } });
}

export type PatchTicketRoomGuestInput = {
  roomChargeReservationId?: string | null;
  guestName?: string | null;
  roomNumber?: string;
};

export async function patchTicketRoomGuest(id: string, body: PatchTicketRoomGuestInput, existing: {
  roomChargeReservationId: string | null;
  guestName: string | null;
  roomNumberLabel: string | null;
}) {
  return prisma.ticket.update({
    where: { id },
    data: {
      roomChargeReservationId:
        body.roomChargeReservationId !== undefined
          ? body.roomChargeReservationId || null
          : body.roomNumber !== undefined
            ? body.roomNumber || null
            : existing.roomChargeReservationId,
      guestName:
        body.guestName !== undefined ? body.guestName || null : existing.guestName,
      roomNumberLabel:
        body.roomNumber !== undefined ? body.roomNumber || null : existing.roomNumberLabel,
    },
    include: { lines: true, table: true, outlet: true },
  });
}

export async function findOpenTicketInOrg(id: string, organizationId: string) {
  return prisma.ticket.findFirst({ where: { id, organizationId } });
}

export async function findPosTableInOutlet(tableId: string, outletId: string) {
  return prisma.posTable.findFirst({
    where: { id: tableId, outletId },
  });
}

export async function moveTicketToTable(ticketId: string, tableId: string) {
  await prisma.$transaction([
    prisma.posTable.updateMany({
      where: { currentTicketId: ticketId },
      data: { currentTicketId: null, status: "FREE" },
    }),
    prisma.ticket.update({ where: { id: ticketId }, data: { tableId } }),
    prisma.posTable.update({
      where: { id: tableId },
      data: { currentTicketId: ticketId, status: "OCCUPIED" },
    }),
  ]);
}

export type AddTicketLineInput = {
  description: string;
  qty: number;
  unitPriceAzn: number;
  menuItemPlu?: string;
  notes?: string;
};

export async function addTicketLines(
  ticketId: string,
  organizationId: string,
  items: AddTicketLineInput[],
) {
  for (const item of items) {
    let menuItemId: string | undefined;
    if (item.menuItemPlu) {
      menuItemId = await findMenuItemIdByPlu(item.menuItemPlu);
    }
    await prisma.ticketLine.create({
      data: {
        organizationId,
        ticketId,
        menuItemId,
        description: item.description,
        qty: item.qty,
        unitPriceAzn: item.unitPriceAzn,
        notes: item.notes,
      },
    });
  }
}

export async function listTicketLines(ticketId: string) {
  return prisma.ticketLine.findMany({ where: { ticketId } });
}

export async function findTicketLineOnTicket(ticketId: string, lineId: string) {
  return prisma.ticketLine.findFirst({
    where: { id: lineId, ticketId },
  });
}

export async function voidTicketLineTillCorrection(lineId: string) {
  await prisma.ticketLine.update({
    where: { id: lineId },
    data: { kitchenStatus: "VOID", notes: "till correction" },
  });
}

export async function updateTicketLineQuantity(lineId: string, qty: number) {
  await prisma.ticketLine.update({
    where: { id: lineId },
    data: { qty },
  });
}

export async function getTicketWithLinesAndTable(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { lines: true, table: true },
  });
}

export async function voidTicketLineWithReason(lineId: string, reason: string) {
  await prisma.ticketLine.update({
    where: { id: lineId },
    data: {
      kitchenStatus: "VOID",
      notes: reason,
    },
  });
}

export async function findTicketWithLines(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { lines: true },
  });
}

export async function voidAllLiveTicketLines(ticketId: string) {
  await prisma.ticketLine.updateMany({
    where: { ticketId, kitchenStatus: { not: "VOID" } },
    data: { kitchenStatus: "VOID", notes: "till correction" },
  });
}

export async function markTicketVoided(ticketId: string) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "VOID", subtotalAzn: 0, totalAzn: 0, closedAt: new Date() },
  });
}

export async function getTicketWithLinesForSplit(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { lines: true },
  });
}

export async function splitLinesToNewTicket(
  source: {
    organizationId: string;
    outletId: string;
    covers: number;
    guestName: string | null;
    openedByName: string | null;
  },
  lineIds: string[],
  organizationIdFallback: string,
  openedByName: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        organizationId: source.organizationId || organizationIdFallback,
        outletId: source.outletId,
        tableId: null,
        covers: source.covers,
        guestName: source.guestName,
        openedByName: source.openedByName ?? openedByName,
        discountPercent: 0,
        subtotalAzn: 0,
        totalAzn: 0,
      },
    });
    await tx.ticketLine.updateMany({
      where: { id: { in: lineIds } },
      data: { ticketId: created.id, organizationId: created.organizationId },
    });
    return created;
  });
}

export async function getTicketWithLinesTableOutlet(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { lines: true, table: true, outlet: true },
  });
}

export async function fireAllNewLinesOnTicket(ticketId: string) {
  return prisma.ticketLine.updateMany({
    where: { ticketId, kitchenStatus: "NEW" },
    data: { kitchenStatus: "FIRED" },
  });
}

export async function fireCourseLinesOnTicket(
  ticketId: string,
  courseNumber: number,
  fireAt: Date,
) {
  return prisma.ticketLine.updateMany({
    where: {
      ticketId,
      courseNumber,
      kitchenStatus: "NEW",
    },
    data: {
      kitchenStatus: "FIRED",
      scheduledFireAt: fireAt,
    },
  });
}

export async function getTicketLinesOnly(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: { lines: true },
  });
}

export async function setTicketDiscountPercent(ticketId: string, discountPercent: number) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { discountPercent },
  });
}

const roomChargeTicketInclude = {
  outlet: true,
  table: true,
  lines: { include: { menuItem: { include: { category: true } } } },
} satisfies Prisma.TicketInclude;

export async function getTicketForRoomCharge(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: roomChargeTicketInclude,
  });
}

export async function closeTicketRoomCharge(
  id: string,
  data: {
    closedAt: Date;
    roomNumberLabel: string | null | undefined;
    shiftId: string | null;
    closedByName: string | null;
  },
) {
  await prisma.ticket.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: data.closedAt,
      paymentMethod: "ROOM",
      tenderRoute: "ROOM",
      roomNumberLabel: data.roomNumberLabel,
      shiftId: data.shiftId,
      closedByName: data.closedByName,
    },
  });
}

const deferHubTicketInclude = {
  table: true,
  outlet: true,
  lines: { include: { menuItem: { include: { category: true } } } },
} satisfies Prisma.TicketInclude;

export async function getTicketForDeferToHub(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: deferHubTicketInclude,
  });
}

export async function markTicketPendingHub(ticketId: string, settlementPendingId: string) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "PENDING_HUB",
      settlementPendingId,
    },
  });
}

export type RoomServiceLineInput = {
  description: string;
  qty: number;
  unitPriceAzn: number;
};

export async function createRoomServiceTicket(
  organizationId: string,
  outletId: string,
  guestName: string,
  openedByName: string | null,
  lines: RoomServiceLineInput[],
  subtotalAzn: number,
) {
  return prisma.ticket.create({
    data: {
      organizationId,
      outletId,
      serviceChannel: "ROOM_SERVICE",
      guestName,
      roomChargeReservationId: null,
      openedByName,
      subtotalAzn,
      totalAzn: subtotalAzn,
      lines: {
        create: lines.map((l) => ({
          organizationId,
          description: l.description,
          qty: l.qty,
          unitPriceAzn: l.unitPriceAzn,
        })),
      },
    },
    include: { lines: true },
  });
}

export type { TicketLine };
