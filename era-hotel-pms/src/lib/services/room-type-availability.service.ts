import { prisma } from '@/lib/prisma';
import { isStopSellForDate } from '@/lib/services/channel.service';
import {
  countDoorsUsedOnNight,
  loadShareSlicesForType,
  type ShareReservationSlice,
} from '@/lib/services/share-assignment.service';
import { addHotelDays, hotelDateKey, parseHotelNoon } from '@/lib/hotel-calendar';

const SELLABLE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

type DayCell = {
  date: string;
  quota: number;
  occupied: number;
  available: number;
  stopSell: boolean;
};

type TypeRow = {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  quota: number;
  days: DayCell[];
};

function eachHotelNight(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cur = fromKey;
  while (cur < toKey) {
    keys.push(cur);
    cur = addHotelDays(cur, 1);
  }
  return keys;
}

/** Occupancy for one hotel-night: door consumption (share-aware). */
async function occupiedDoorsOnNight(roomTypeId: string, nightKey: string): Promise<number> {
  const nightStart = parseHotelNoon(nightKey);
  const nightEnd = parseHotelNoon(addHotelDays(nightKey, 1));
  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    select: { adultCapacity: true },
  });
  const maxBed = roomType?.adultCapacity ?? 2;
  const slices: ShareReservationSlice[] = await loadShareSlicesForType(
    roomTypeId,
    nightStart,
    nightEnd,
  );
  return countDoorsUsedOnNight(slices, nightStart, maxBed);
}

/**
 * FO Room Type Availability matrix (Electra-style Avl / Occ).
 * Occ includes unassigned stays. Avl may be negative (overbook signal).
 */
export async function getRoomTypeAvailabilityMatrix(from: Date, to: Date) {
  const fromKey = hotelDateKey(from);
  const toKey = hotelDateKey(to);
  const nights = eachHotelNight(fromKey, toKey);
  if (nights.length === 0) {
    return { from: fromKey, to: toKey, nights: [] as string[], rows: [] as TypeRow[], totals: [] as DayCell[] };
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, baseQuota: true },
  });

  const rows: TypeRow[] = [];
  for (const rt of roomTypes) {
    const days: DayCell[] = [];
    for (const night of nights) {
      const occupied = await occupiedDoorsOnNight(rt.id, night);
      const stopSell = await isStopSellForDate(parseHotelNoon(night), rt.id);
      const available = stopSell ? 0 : rt.baseQuota - occupied;
      days.push({
        date: night,
        quota: rt.baseQuota,
        occupied,
        available,
        stopSell,
      });
    }
    rows.push({
      roomTypeId: rt.id,
      roomTypeCode: rt.code,
      roomTypeName: rt.name,
      quota: rt.baseQuota,
      days,
    });
  }

  const totals: DayCell[] = nights.map((night, i) => {
    let occupied = 0;
    let quota = 0;
    let stopAll = true;
    for (const row of rows) {
      const d = row.days[i];
      if (!d) continue;
      occupied += d.occupied;
      quota += d.quota;
      if (!d.stopSell) stopAll = false;
    }
    const available = stopAll ? 0 : quota - occupied;
    return { date: night, quota, occupied, available, stopSell: stopAll };
  });

  return { from: fromKey, to: toKey, nights, rows, totals };
}

/** Min sellable nights across stay — same gate as createReservation. */
export async function getSellablePreview(roomTypeId: string, checkIn: Date, checkOut: Date) {
  const { getAvailability } = await import('@/lib/services/reservation.service');
  return getAvailability(roomTypeId, checkIn, checkOut);
}
