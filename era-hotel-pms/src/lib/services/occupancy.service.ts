import { prisma } from '@/lib/prisma';

const ACTIVE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): void {
  d.setDate(d.getDate() + n);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface OccupancyCell {
  date: string;
  total: number;
  sold: number;
  available: number;
}

export interface OccupancyRow {
  roomTypeId: string;
  code: string;
  name: string;
  cells: OccupancyCell[];
  avgOccupancyPct: number;
}

export interface OccupancyGrid {
  from: string;
  days: number;
  dates: string[];
  rows: OccupancyRow[];
}

function reservationOccupiesNight(
  checkIn: Date,
  checkOut: Date,
  nightStart: Date,
  nightEnd: Date,
): boolean {
  return checkIn < nightEnd && checkOut > nightStart;
}

export async function getOccupancyGrid(input?: {
  from?: Date;
  days?: number;
}): Promise<OccupancyGrid> {
  const days = input?.days ?? 30;
  const from = startOfDay(input?.from ?? new Date());

  const dates: string[] = [];
  const dateObjects: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    addDays(d, i);
    dates.push(dateKey(d));
    dateObjects.push(d);
  }

  const windowEnd = new Date(from);
  addDays(windowEnd, days);

  const roomTypes = await prisma.roomType.findMany({ orderBy: { code: 'asc' } });
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      checkInDate: { lt: windowEnd },
      checkOutDate: { gt: from },
    },
    select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
  });

  const rows: OccupancyRow[] = roomTypes.map((rt) => {
    const typeReservations = reservations.filter((r) => r.roomTypeId === rt.id);
    let totalSoldNights = 0;

    const cells: OccupancyCell[] = dateObjects.map((nightStart, idx) => {
      const nightEnd = new Date(nightStart);
      nightEnd.setDate(nightEnd.getDate() + 1);

      const sold = typeReservations.filter((r) =>
        reservationOccupiesNight(r.checkInDate, r.checkOutDate, nightStart, nightEnd),
      ).length;

      totalSoldNights += sold;
      const total = rt.baseQuota;
      const available = total - sold;

      return {
        date: dates[idx],
        total,
        sold,
        available,
      };
    });

    const capacity = rt.baseQuota * days;
    const avgOccupancyPct =
      capacity > 0 ? Math.round((totalSoldNights / capacity) * 1000) / 10 : 0;

    return {
      roomTypeId: rt.id,
      code: rt.code,
      name: rt.name,
      cells,
      avgOccupancyPct,
    };
  });

  return { from: dateKey(from), days, dates, rows };
}
