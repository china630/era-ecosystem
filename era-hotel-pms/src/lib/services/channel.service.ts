import { prisma } from '@/lib/prisma';

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function eachNight(from: Date, to: Date): Date[] {
  const nights: Date[] = [];
  const cur = dateOnly(from);
  const end = dateOnly(to);
  while (cur < end) {
    nights.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

export async function isStopSellForDate(date: Date, roomTypeId: string): Promise<boolean> {
  const d = dateOnly(date);
  const hit = await prisma.channelStopSell.findFirst({
    where: {
      date: d,
      OR: [{ roomTypeId: null }, { roomTypeId }],
    },
  });
  return hit != null;
}

export async function hasStopSellInRange(
  roomTypeId: string,
  from: Date,
  to: Date,
): Promise<boolean> {
  for (const night of eachNight(from, to)) {
    if (await isStopSellForDate(night, roomTypeId)) return true;
  }
  return false;
}

export async function listStopSells(from?: Date, to?: Date) {
  return prisma.channelStopSell.findMany({
    where: {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: dateOnly(from) } : {}),
              ...(to ? { lte: dateOnly(to) } : {}),
            },
          }
        : {}),
    },
    include: { roomType: true },
    orderBy: { date: 'asc' },
  });
}

export async function createStopSell(input: {
  date: Date;
  roomTypeId?: string;
  note?: string;
}) {
  const d = dateOnly(input.date);
  const roomTypeId = input.roomTypeId ?? null;

  if (!roomTypeId) {
    await prisma.channelStopSell.deleteMany({
      where: { date: d, roomTypeId: null },
    });
  }

  const existing = await prisma.channelStopSell.findFirst({
    where: { date: d, roomTypeId },
  });

  if (existing) {
    return prisma.channelStopSell.update({
      where: { id: existing.id },
      data: { note: input.note },
      include: { roomType: true },
    });
  }

  return prisma.channelStopSell.create({
    data: { date: d, roomTypeId, note: input.note },
    include: { roomType: true },
  });
}

export async function removeStopSell(id: string) {
  return prisma.channelStopSell.delete({ where: { id } });
}

export async function getChannelAvailability(from: Date, to: Date) {
  const roomTypes = await prisma.roomType.findMany({ orderBy: { code: 'asc' } });
  const nights = eachNight(from, to);
  const result = [];

  for (const rt of roomTypes) {
    const rows = [];
    for (const night of nights) {
      const stopSell = await isStopSellForDate(night, rt.id);
      const overlapping = await prisma.reservation.count({
        where: {
          roomTypeId: rt.id,
          status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
          checkInDate: { lt: new Date(night.getTime() + 86400000) },
          checkOutDate: { gt: night },
        },
      });
      const effectiveQuota = stopSell ? 0 : rt.baseQuota;
      rows.push({
        date: night.toISOString().slice(0, 10),
        baseQuota: rt.baseQuota,
        booked: overlapping,
        stopSell,
        available: Math.max(0, effectiveQuota - overlapping),
      });
    }
    result.push({ roomTypeId: rt.id, roomTypeCode: rt.code, days: rows });
  }
  return result;
}

export async function listSyncErrors() {
  return prisma.channelSyncError.findMany({
    include: { reservation: { include: { guest: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function logSyncError(input: {
  reservationId?: string;
  otaReference?: string;
  errorMessage: string;
}) {
  return prisma.channelSyncError.create({ data: input });
}

export async function resolveSyncError(id: string) {
  return prisma.channelSyncError.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });
}

export async function handleOtaCancel(otaReference: string) {
  const error = await prisma.channelSyncError.findFirst({
    where: { otaReference, status: 'OPEN' },
    include: { reservation: true },
  });

  if (error?.reservationId) {
    await prisma.reservation.update({
      where: { id: error.reservationId },
      data: { status: 'CANCELLED' },
    });
    await resolveSyncError(error.id);
    return { cancelled: true, reservationId: error.reservationId };
  }

  const reservation = await prisma.reservation.findFirst({
    where: { source: { code: 'OTA' } },
    orderBy: { createdAt: 'desc' },
  });

  if (reservation) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
    });
    return { cancelled: true, reservationId: reservation.id };
  }

  return { cancelled: false };
}
