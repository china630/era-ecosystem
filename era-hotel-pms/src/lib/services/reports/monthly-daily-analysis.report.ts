import { prisma } from '@/lib/prisma';

export interface MonthlyDailyRow {
  date: string;
  roomsSold: number;
  roomsAvailable: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revPar: number;
}

export async function queryMonthlyDailyAnalysis(
  monthStart: Date,
  businessDate: Date,
): Promise<MonthlyDailyRow[]> {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { id: true, status: true },
  });

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const oooCount = rooms.filter((r) => r.status === 'OOO' || r.status === 'OOS').length;
  const sellable = totalRooms - oooCount;

  const startIso = monthStart.toISOString().slice(0, 10);
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
      where: {
        businessDate: { gte: windowStart, lt: windowEnd },
      },
      select: { businessDate: true, amount: true },
    }),
  ]);

  const revenueByDate = new Map<string, number>();
  for (const c of charges) {
    const key = c.businessDate.toISOString().slice(0, 10);
    revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(c.amount));
  }

  const rows: MonthlyDailyRow[] = [];
  const cursor = new Date(windowStart);

  while (cursor < windowEnd) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const nightEnd = new Date(cursor);
    nightEnd.setUTCDate(nightEnd.getUTCDate() + 1);

    const roomsSold = reservations.filter(
      (r) => r.checkInDate < nightEnd && r.checkOutDate > cursor,
    ).length;

    const revenue = revenueByDate.get(dateKey) ?? 0;
    const occupancyPct = sellable > 0 ? Math.round((roomsSold / sellable) * 1000) / 10 : 0;
    const adr = roomsSold > 0 ? Math.round((revenue / roomsSold) * 100) / 100 : 0;
    const revPar = sellable > 0 ? Math.round((revenue / sellable) * 100) / 100 : 0;

    rows.push({
      date: dateKey,
      roomsSold,
      roomsAvailable: sellable,
      occupancyPct,
      revenue,
      adr,
      revPar,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}
