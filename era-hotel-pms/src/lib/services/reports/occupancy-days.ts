import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export type OccupancyDayRow = {
  day: string;
  roomsSold: number;
  revenue: number;
};

const SOLD_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] as const;

function utcDay(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function ymd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eachDay(fromIso: string, toIso: string): string[] {
  const days: string[] = [];
  const cursor = utcDay(fromIso);
  const end = utcDay(toIso).getTime();
  while (cursor.getTime() <= end) {
    days.push(ymd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Rooms sold and room revenue for each calendar day in [fromIso, toIso]. */
export async function queryOccupancyDays(fromIso: string, toIso: string): Promise<OccupancyDayRow[]> {
  const organizationId = requestOrganizationId();
  const from = utcDay(fromIso);
  const toExclusive = utcDay(toIso);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const [reservations, charges] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        organizationId,
        status: { in: [...SOLD_STATUSES] },
        checkInDate: { lt: toExclusive },
        checkOutDate: { gt: from },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
    prisma.folioCharge.findMany({
      where: {
        organizationId,
        businessDate: { gte: from, lt: toExclusive },
      },
      select: { businessDate: true, amount: true },
    }),
  ]);

  return eachDay(fromIso, toIso).map((day) => {
    const start = utcDay(day);
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + 1);
    const roomsSold = reservations.filter(
      (row) => row.checkInDate < next && row.checkOutDate > start,
    ).length;
    const revenue = charges.reduce((sum, row) => {
      if (row.businessDate < start || row.businessDate >= next) return sum;
      return sum + Number(row.amount);
    }, 0);
    return { day, roomsSold, revenue };
  });
}
