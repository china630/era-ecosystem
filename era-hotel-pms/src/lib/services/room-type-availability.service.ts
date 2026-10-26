import { prisma } from '@/lib/prisma';
import { isStopSellForDate } from '@/lib/services/channel.service';
import {
  countDoorsUsedOnNight,
  loadInventoryStays,
  segmentsConsumingType,
} from '@/lib/services/share-assignment.service';
import { addHotelDays, hotelDateKey, parseHotelNoon } from '@/lib/hotel-calendar';

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

/**
 * FO Room Type Availability matrix (Electra-style Avl / Occ).
 * An assigned door counts as that door's type. An unassigned stay counts as the sold type.
 * Avl may be negative (overbook signal).
 * Night membership is the Asia/Baku civil date — same `stayOccupiesHotelNight` as sellable/create.
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
    select: { id: true, code: true, name: true, baseQuota: true, adultCapacity: true },
  });
  const stays = await loadInventoryStays(
    parseHotelNoon(nights[0]!),
    parseHotelNoon(addHotelDays(nights[nights.length - 1]!, 1)),
  );

  const rows: TypeRow[] = [];
  for (const rt of roomTypes) {
    const segments = segmentsConsumingType(rt.id, stays);
    const maxBed = rt.adultCapacity ?? 2;
    const days: DayCell[] = [];
    for (const night of nights) {
      const occupied = countDoorsUsedOnNight(segments, parseHotelNoon(night), maxBed);
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

/** Min sellable nights across stay — same hotel-noon Occ as the availability matrix. */
export async function getSellablePreview(roomTypeId: string, checkIn: Date, checkOut: Date) {
  const { getAvailability } = await import('@/lib/services/reservation.service');
  return getAvailability(roomTypeId, parseHotelNoon(checkIn), parseHotelNoon(checkOut));
}
