import { hotelDateKey, parseHotelNoon, addHotelDays, reservationStayOverlaps } from '@/lib/hotel-calendar';
import type { RoomPlanReservationBar } from './types';
import { calendarDateKey, parseCalendarDate } from './shapes';

export type ShareLaneInput = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  shareEligible?: boolean;
  shareBedIndex?: number | null;
  adults?: number | null;
  shareGender?: string | null;
};

function isEffectiveShare(b: ShareLaneInput): boolean {
  if (!b.shareEligible) return false;
  if ((b.adults ?? 1) !== 1) return false;
  const g = (b.shareGender ?? '').trim().toUpperCase();
  return Boolean(g) && (g.startsWith('M') || g.startsWith('F'));
}

function stayOverlaps(a: ShareLaneInput, b: ShareLaneInput): boolean {
  return reservationStayOverlaps(
    {
      checkInDate: parseCalendarDate(a.checkInDate),
      checkOutDate: parseCalendarDate(a.checkOutDate),
    },
    {
      checkInDate: parseCalendarDate(b.checkInDate),
      checkOutDate: parseCalendarDate(b.checkOutDate),
    },
  );
}

/**
 * Assign paint lanes for share stays on one door.
 * Prefer shareBedIndex-1 when free; else first lane without date overlap.
 * Never paints two overlapping stays on the same lane.
 */
export function assignSharePaintLanes(
  bars: ShareLaneInput[],
  maxBed: number = 2,
): Map<string, number> {
  const shareBars = bars.filter(isEffectiveShare);
  const exclusive = bars.filter((b) => !isEffectiveShare(b));
  const laneById = new Map<string, number>();

  for (const b of exclusive) {
    laneById.set(b.id, 0);
  }

  const sorted = [...shareBars].sort((a, b) => {
    const ci = calendarDateKey(a.checkInDate).localeCompare(calendarDateKey(b.checkInDate));
    if (ci !== 0) return ci;
    return a.id.localeCompare(b.id);
  });

  const laneOccupants: ShareLaneInput[][] = [];

  for (const bar of sorted) {
    const preferred =
      bar.shareBedIndex != null && bar.shareBedIndex >= 1
        ? bar.shareBedIndex - 1
        : null;

    const fits = (lane: number) => {
      const occupants = laneOccupants[lane] ?? [];
      return !occupants.some((o) => stayOverlaps(o, bar));
    };

    let chosen: number | null = null;
    if (preferred != null && preferred >= 0 && fits(preferred)) {
      chosen = preferred;
    } else {
      const limit = Math.max(maxBed, laneOccupants.length + 1, 1);
      for (let lane = 0; lane < limit + sorted.length; lane++) {
        if (fits(lane)) {
          chosen = lane;
          break;
        }
      }
    }
    if (chosen == null) chosen = laneOccupants.length;
    if (!laneOccupants[chosen]) laneOccupants[chosen] = [];
    laneOccupants[chosen]!.push(bar);
    laneById.set(bar.id, chosen);
  }

  return laneById;
}

/** How many paint lanes a room row needs. */
export function shareLaneCount(
  bars: ShareLaneInput[],
  capacityHint?: number | null,
): number {
  const hasShare = bars.some(isEffectiveShare);
  if (!hasShare) return 1;
  const lanes = assignSharePaintLanes(bars, capacityHint ?? 2);
  let maxLane = 0;
  for (const lane of lanes.values()) {
    if (lane > maxLane) maxLane = lane;
  }
  const fromPaint = maxLane + 1;
  const fromCap = Math.max(capacityHint ?? 2, 2);
  return Math.max(fromPaint, fromCap);
}

/** Re-export helpers used by bed-index tests. */
export { hotelDateKey, parseHotelNoon, addHotelDays };

/** Map RoomPlanReservationBar → ShareLaneInput */
export function toShareLaneInput(b: RoomPlanReservationBar): ShareLaneInput {
  return {
    id: b.id,
    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    shareEligible: b.shareEligible,
    shareBedIndex: b.shareBedIndex,
    adults: b.adults,
    shareGender: b.shareGender,
  };
}
