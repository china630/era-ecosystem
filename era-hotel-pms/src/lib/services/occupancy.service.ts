import { bakuDayBounds } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';

const ACTIVE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

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
  const fromKey = hotelDateKey(input?.from ?? new Date());
  const { start: from } = bakuDayBounds(fromKey);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addHotelDays(fromKey, i));
  }

  const windowEnd = bakuDayBounds(addHotelDays(fromKey, days)).start;

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

    const cells: OccupancyCell[] = dates.map((nightKey) => {
      const { start: nightStart, end: nightEnd } = bakuDayBounds(nightKey);

      const sold = typeReservations.filter((r) =>
        reservationOccupiesNight(r.checkInDate, r.checkOutDate, nightStart, nightEnd),
      ).length;

      totalSoldNights += sold;
      const total = rt.baseQuota;
      const available = total - sold;

      return {
        date: nightKey,
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

  return { from: fromKey, days, dates, rows };
}
