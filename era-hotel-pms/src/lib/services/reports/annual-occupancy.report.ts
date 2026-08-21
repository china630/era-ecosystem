import { prisma } from '@/lib/prisma';

export interface AnnualOccupancyRow {
  month: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revPar: number;
}

export async function queryAnnualOccupancy(
  yearStart: Date,
  businessDate: Date,
): Promise<AnnualOccupancyRow[]> {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { status: true },
  });

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const oooCount = rooms.filter((r) => r.status === 'OOO' || r.status === 'OOS').length;
  const sellable = totalRooms - oooCount;

  const startIso = yearStart.toISOString().slice(0, 10);
  const endIso = businessDate.toISOString().slice(0, 10);
  const windowStart = new Date(`${startIso}T00:00:00.000Z`);
  const windowEnd = new Date(`${endIso}T00:00:00.000Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const [reservations, charges] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: windowEnd },
        checkOutDate: { gt: windowStart },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: windowStart, lt: windowEnd } },
      select: { businessDate: true, amount: true },
    }),
  ]);

  const rows: AnnualOccupancyRow[] = [];
  const cursor = new Date(windowStart);

  while (cursor <= businessDate) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));
    const effectiveEnd = monthEnd > windowEnd ? windowEnd : monthEnd;

    const daysInRange = Math.round(
      (effectiveEnd.getTime() - monthStart.getTime()) / 86_400_000,
    );
    const roomsAvailable = sellable * daysInRange;

    let roomNightsSold = 0;
    const dayIter = new Date(monthStart);
    while (dayIter < effectiveEnd) {
      const nextDayIter = new Date(dayIter);
      nextDayIter.setUTCDate(nextDayIter.getUTCDate() + 1);
      roomNightsSold += reservations.filter(
        (r) => r.checkInDate < nextDayIter && r.checkOutDate > dayIter,
      ).length;
      dayIter.setUTCDate(dayIter.getUTCDate() + 1);
    }

    const revenue = charges
      .filter((c) => {
        const d = c.businessDate;
        return d >= monthStart && d < effectiveEnd;
      })
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const occupancyPct =
      roomsAvailable > 0 ? Math.round((roomNightsSold / roomsAvailable) * 1000) / 10 : 0;
    const adr = roomNightsSold > 0 ? Math.round((revenue / roomNightsSold) * 100) / 100 : 0;
    const revPar = roomsAvailable > 0 ? Math.round((revenue / roomsAvailable) * 100) / 100 : 0;

    const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;
    rows.push({
      month: monthLabel,
      roomsAvailable,
      roomsSold: roomNightsSold,
      occupancyPct,
      revenue,
      adr,
      revPar,
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    cursor.setUTCDate(1);
  }

  return rows;
}
