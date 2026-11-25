import { prisma } from '@/lib/prisma';
import {
  countDoorsUsedOnNight,
  loadInventoryStays,
  resolveMaxBed,
  segmentsConsumingType,
  segmentsPhysicalOnType,
  segmentsSoldAsType,
} from '@/lib/services/share-assignment.service';
import { hotelDateKey, parseHotelNoon, addHotelDays } from '@/lib/hotel-calendar';

type DayCell = {
  date: string;
  /** Physical fund (baseQuota) — display baseline for Avl. */
  quota: number;
  /** Opera house inventory used (unassigned charged + assigned door). */
  occupied: number;
  /** Charged-type stays overlapping the night. */
  occupiedSold: number;
  /** Assigned doors of this physical type. */
  occupiedPhysical: number;
  /**
   * Display Avl = baseQuota − occupied (may be negative = into overbook).
   * Stop-sell forces 0. Sell/TYPE_CAP still use base+overbook elsewhere.
   */
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

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * FO Room Type Availability matrix (Electra-style Avl / Occ).
 * Opera inventory: unassigned → charged type; assigned → door type.
 * Avl is balance vs baseQuota (negative = overbook). Sell caps stay base+allowance.
 * One inventory load + one stop-sell load for the whole matrix.
 */
export async function getRoomTypeAvailabilityMatrix(from: Date, to: Date) {
  const fromKey = hotelDateKey(from);
  const toKey = hotelDateKey(to);
  const nights = eachHotelNight(fromKey, toKey);
  if (nights.length === 0) {
    return { from: fromKey, to: toKey, nights: [] as string[], rows: [] as TypeRow[], totals: [] as DayCell[] };
  }

  const rangeFrom = parseHotelNoon(nights[0]!);
  const rangeTo = parseHotelNoon(addHotelDays(nights[nights.length - 1]!, 1));

  const [roomTypes, stays, stopRows] = await Promise.all([
    prisma.roomType.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, baseQuota: true, adultCapacity: true },
    }),
    loadInventoryStays(rangeFrom, rangeTo),
    prisma.channelStopSell.findMany({
      where: {
        date: {
          gte: dateOnlyUtc(rangeFrom),
          lt: dateOnlyUtc(rangeTo),
        },
      },
      select: { date: true, roomTypeId: true },
    }),
  ]);

  const stopAllNights = new Set<string>();
  const stopByType = new Map<string, Set<string>>();
  for (const row of stopRows) {
    const key = hotelDateKey(row.date);
    if (row.roomTypeId == null) {
      stopAllNights.add(key);
      continue;
    }
    const set = stopByType.get(row.roomTypeId) ?? new Set<string>();
    set.add(key);
    stopByType.set(row.roomTypeId, set);
  }

  const typeIds = roomTypes.map((rt) => rt.id);
  const inventoryByType = new Map(
    typeIds.map((id) => [id, segmentsConsumingType(id, stays)] as const),
  );
  const soldByType = new Map(typeIds.map((id) => [id, segmentsSoldAsType(id, stays)] as const));
  const physicalByType = new Map(
    typeIds.map((id) => [id, segmentsPhysicalOnType(id, stays)] as const),
  );
  const bedByType = new Map(
    roomTypes.map((rt) => [rt.id, resolveMaxBed(null, rt.adultCapacity)] as const),
  );

  const sumBase = roomTypes.reduce((sum, rt) => sum + rt.baseQuota, 0);

  const rows: TypeRow[] = [];
  const houseOccByNight = new Map<string, number>();

  for (const rt of roomTypes) {
    const inv = inventoryByType.get(rt.id) ?? [];
    const sold = soldByType.get(rt.id) ?? [];
    const phys = physicalByType.get(rt.id) ?? [];
    const bed = bedByType.get(rt.id) ?? 2;
    const typeStops = stopByType.get(rt.id);
    const days: DayCell[] = [];
    for (const nightKey of nights) {
      const night = parseHotelNoon(nightKey);
      const stopSell = stopAllNights.has(nightKey) || Boolean(typeStops?.has(nightKey));
      const occupied = countDoorsUsedOnNight(inv, night, bed);
      const occupiedSold = countDoorsUsedOnNight(sold, night, bed);
      const occupiedPhysical = countDoorsUsedOnNight(phys, night, bed);
      const available = stopSell ? 0 : rt.baseQuota - occupied;
      days.push({
        date: nightKey,
        quota: rt.baseQuota,
        occupied,
        occupiedSold,
        occupiedPhysical,
        available,
        stopSell,
      });
      houseOccByNight.set(nightKey, (houseOccByNight.get(nightKey) ?? 0) + occupied);
    }
    rows.push({
      roomTypeId: rt.id,
      roomTypeCode: rt.code,
      roomTypeName: rt.name,
      quota: rt.baseQuota,
      days,
    });
  }

  const totals: DayCell[] = nights.map((nightKey, i) => {
    let stopAll = true;
    let sold = 0;
    let phys = 0;
    for (const row of rows) {
      const cell = row.days[i];
      if (!cell?.stopSell) stopAll = false;
      sold += cell?.occupiedSold ?? 0;
      phys += cell?.occupiedPhysical ?? 0;
    }
    const occupied = houseOccByNight.get(nightKey) ?? 0;
    return {
      date: nightKey,
      quota: sumBase,
      occupied,
      occupiedSold: sold,
      occupiedPhysical: phys,
      // Display vs physical fund (sum of baseQuota). House overbook is sell-only.
      available: stopAll ? 0 : sumBase - occupied,
      stopSell: stopAll,
    };
  });

  return { from: fromKey, to: toKey, nights, rows, totals };
}

/**
 * Min sellable across stay nights (base+overbook / house cap).
 * Same hotel-noon inventory window as the matrix; Avl numbers differ (matrix = vs base).
 */
export async function getSellablePreview(roomTypeId: string, checkIn: Date, checkOut: Date) {
  const { getAvailability } = await import('@/lib/services/reservation.service');
  return getAvailability(roomTypeId, parseHotelNoon(checkIn), parseHotelNoon(checkOut));
}
