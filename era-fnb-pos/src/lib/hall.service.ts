import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const tableListSelect = {
  id: true,
  code: true,
  name: true,
  seats: true,
  zone: true,
  hallId: true,
  hall: { select: { id: true, name: true, sortOrder: true } },
  status: true,
  outletId: true,
  currentTicketId: true,
} as const;

export function listPosTablesForFloor() {
  return prisma.posTable.findMany({
    orderBy: { code: "asc" },
    select: tableListSelect,
  });
}

export function listOpenHeldTicketsWithTables() {
  return prisma.ticket.findMany({
    where: {
      status: { in: ["OPEN", "HELD"] },
      tableId: { not: null },
    },
    select: {
      id: true,
      tableId: true,
      totalAzn: true,
      openedAt: true,
      waiterLabel: true,
      openedByName: true,
      covers: true,
    },
  });
}

export function findPosHallInOutlet(hallId: string, outletId: string) {
  return prisma.posHall.findFirst({ where: { id: hallId, outletId } });
}

export function createPosTable(data: {
  organizationId: string;
  outletId: string;
  code: string;
  name: string;
  seats: number;
  zone: string | null;
  hallId: string | null;
}) {
  return prisma.posTable.create({ data });
}

export function findPosTableById(id: string) {
  return prisma.posTable.findUnique({ where: { id } });
}

export function updatePosTable(id: string, data: Prisma.PosTableUpdateInput) {
  return prisma.posTable.update({ where: { id }, data });
}

export function deletePosTable(id: string) {
  return prisma.posTable.delete({ where: { id } });
}

export function listPosHallsForOutlet(outletId: string) {
  return prisma.posHall.findMany({
    where: { outletId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { tables: true } } },
  });
}

export function listPosHallNamesForOutlet(outletId: string) {
  return prisma.posHall.findMany({
    where: { outletId },
    select: { name: true },
  });
}

export function findPosHallWithHighestSortOrder(outletId: string) {
  return prisma.posHall.findFirst({
    where: { outletId },
    orderBy: { sortOrder: "desc" },
  });
}

export function createPosHall(data: {
  organizationId: string;
  outletId: string;
  name: string;
  sortOrder: number;
}) {
  return prisma.posHall.create({
    data: {
      organizationId: data.organizationId,
      outletId: data.outletId,
      name: data.name,
      sortOrder: data.sortOrder,
    },
  });
}

export function findPosHallById(id: string) {
  return prisma.posHall.findUnique({ where: { id } });
}

export function listPosHallsOrderedForOutlet(outletId: string) {
  return prisma.posHall.findMany({
    where: { outletId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
  });
}

export function applyPosHallSortOrders(updates: Array<{ id: string; sortOrder: number }>) {
  return prisma.$transaction(
    updates.map((row) =>
      prisma.posHall.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } }),
    ),
  );
}

export function listOtherPosHallNames(outletId: string, excludeHallId: string) {
  return prisma.posHall.findMany({
    where: { outletId, NOT: { id: excludeHallId } },
    select: { name: true },
  });
}

export function updatePosHall(id: string, data: Prisma.PosHallUpdateInput) {
  return prisma.posHall.update({ where: { id }, data });
}

export function findPosHallWithTableStatuses(id: string) {
  return prisma.posHall.findUnique({
    where: { id },
    include: { tables: { select: { status: true, currentTicketId: true } } },
  });
}

export function deletePosHallAndDetachTables(hallId: string) {
  return prisma.$transaction([
    prisma.posTable.updateMany({ where: { hallId }, data: { hallId: null } }),
    prisma.posHall.delete({ where: { id: hallId } }),
  ]);
}
