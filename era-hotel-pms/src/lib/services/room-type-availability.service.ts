import { prisma } from '@/lib/prisma';
import { isStopSellForDate } from '@/lib/services/channel.service';
import { sellStatesForType } from '@/lib/services/inventory-guard.service';
import { hotelDateKey, parseHotelNoon, addHotelDays } from '@/lib/hotel-calendar';

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
 * Avl is what can still be sold: baseQuota + type allowance, also inside the house cap.
 * Stop-sell forces Avl 0. Night membership is the Asia/Baku civil date.
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

  const rows: TypeRow[] = [];
  const houseLeftByNight = new Map<string, { quota: number; occupied: number; available: number; stopSell: boolean }>();
  for (const rt of roomTypes) {
    const { states } = await sellStatesForType(
      rt.id,
      parseHotelNoon(nights[0]!),
      parseHotelNoon(addHotelDays(nights[nights.length - 1]!, 1)),
    );
    const byDate = new Map(states.map((state) => [hotelDateKey(state.night), state]));
    const days: DayCell[] = [];
    for (const night of nights) {
      const state = byDate.get(night);
      const stopSell = state?.stopSell ?? (await isStopSellForDate(parseHotelNoon(night), rt.id));
      const occupied = state?.typeUsed ?? 0;
      const available = state?.available ?? 0;
      days.push({
        date: night,
        quota: rt.baseQuota,
        occupied,
        available,
        stopSell,
      });
      if (state && !houseLeftByNight.has(night)) {
        houseLeftByNight.set(night, {
          quota: state.houseCap,
          occupied: state.houseUsed,
          available: Math.max(0, state.houseCap - state.houseUsed),
          stopSell: false,
        });
      }
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
    const house = houseLeftByNight.get(night);
    if (house) {
      let stopAll = true;
      for (const row of rows) {
        if (!row.days[i]?.stopSell) stopAll = false;
      }
      return {
        date: night,
        quota: house.quota,
        occupied: house.occupied,
        available: stopAll ? 0 : house.available,
        stopSell: stopAll,
      };
    }
    return { date: night, quota: 0, occupied: 0, available: 0, stopSell: true };
  });

  return { from: fromKey, to: toKey, nights, rows, totals };
}

/** Min sellable nights across stay — same hotel-noon Occ as the availability matrix. */
export async function getSellablePreview(roomTypeId: string, checkIn: Date, checkOut: Date) {
  const { getAvailability } = await import('@/lib/services/reservation.service');
  return getAvailability(roomTypeId, parseHotelNoon(checkIn), parseHotelNoon(checkOut));
}
