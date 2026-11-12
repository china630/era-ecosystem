import { prisma } from "@/lib/prisma";
import { reportFnbPosStationCapacity } from "@/lib/report-pos-capacity";

export async function findLatestOpenPosShift() {
  return prisma.posShift.findFirst({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "desc" },
  });
}

export async function closedTicketsForShiftDrawer(
  outletId: string,
  openedAt: Date,
  through: Date,
) {
  return prisma.ticket.findMany({
    where: {
      outletId,
      status: "CLOSED",
      closedAt: { gte: openedAt, lte: through },
    },
    select: { paymentMethod: true, totalAzn: true },
  });
}

export async function countOpenHeldTickets(outletId: string) {
  return prisma.ticket.count({
    where: { outletId, status: { in: ["OPEN", "HELD"] } },
  });
}

export async function findOpenPosShiftForOutlet(outletId: string) {
  return prisma.posShift.findFirst({
    where: { outletId, status: "OPEN" },
    include: { outlet: true },
  });
}

export async function createPosShift(data: {
  outletId: string;
  openingCash: number;
  openedBy: string | null;
  fiscalDeviceId: string | null;
  bankTerminalId: string | null;
}) {
  return prisma.posShift.create({
    data,
    include: { outlet: true },
  });
}

export async function reportFnbPosStationCapacityFireAndForget() {
  void reportFnbPosStationCapacity(prisma).catch(() => undefined);
}

export async function resolvePosShiftForOps(shiftId?: string) {
  if (shiftId) {
    return prisma.posShift.findUnique({
      where: { id: shiftId },
      include: { outlet: true },
    });
  }
  return prisma.posShift.findFirst({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "desc" },
  });
}

export async function countOpenHeldTicketsOnOutlet(outletId: string) {
  return prisma.ticket.count({
    where: {
      outletId,
      status: { in: ["OPEN", "HELD"] },
    },
  });
}

export async function finalizePosShiftClose(
  shiftId: string,
  data: {
    closedAt: Date;
    countedCash: number;
    expectedCash: number;
    cashVariance: number | null;
  },
) {
  return prisma.posShift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedAt: data.closedAt,
      countedCash: data.countedCash,
      expectedCash: data.expectedCash,
      cashVariance: data.cashVariance,
    },
    include: { outlet: true },
  });
}

export async function revokeOutletTerminal(outletId: string, revokedAt: Date) {
  await prisma.outlet.update({
    where: { id: outletId },
    data: { terminalRevokedAt: revokedAt },
  });
}

export async function createPosCashDrop(data: {
  organizationId: string;
  shiftId: string;
  amountAzn: number;
  note: string | null;
}) {
  await prisma.posCashDrop.create({
    data: {
      organizationId: data.organizationId,
      shiftId: data.shiftId,
      amountAzn: data.amountAzn,
      note: data.note,
    },
  });
}

export async function listAllOpenPosShifts() {
  return prisma.posShift.findMany({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "asc" },
  });
}
