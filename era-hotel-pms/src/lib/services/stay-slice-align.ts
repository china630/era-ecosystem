import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';

export type AlignSlice = {
  id: string;
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
};

export type AlignSliceUpdate = {
  id: string;
  fromDate?: Date;
  toDate?: Date;
  roomId?: string | null;
};

export type AlignSliceCreate = {
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
};

export type AlignStaySlicesResult = {
  updates: AlignSliceUpdate[];
  deletes: string[];
  creates: AlignSliceCreate[];
};

type WorkingSlice = {
  id: string;
  fromKey: string;
  toKey: string;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
  fromChanged: boolean;
  toChanged: boolean;
  roomChanged: boolean;
};

/**
 * Make stay slices cover the reservation header and no more.
 * Dates clamp to [check-in, check-out). A missing door on a live segment
 * becomes the header door. An internal hole is filled on that door.
 * A longer stay extends the last slice. Tariff roomTypeId on an existing
 * slice is left as stored.
 */
export function alignStaySlices(input: {
  checkIn: Date;
  checkOut: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
  slices: AlignSlice[];
  /** Departed stays only lose dates that sit outside the header. */
  datesOnly?: boolean;
}): AlignStaySlicesResult {
  const cin = hotelDateKey(input.checkIn);
  const cout = hotelDateKey(input.checkOut);
  const deletes: string[] = [];
  const working: WorkingSlice[] = [];

  if (cin >= cout) {
    return { updates: [], deletes: input.slices.map((slice) => slice.id), creates: [] };
  }

  for (const slice of input.slices) {
    let fromKey = hotelDateKey(slice.fromDate);
    let toKey = hotelDateKey(slice.toDate);
    if (toKey <= cin || fromKey >= cout) {
      deletes.push(slice.id);
      continue;
    }
    let fromChanged = false;
    let toChanged = false;
    let roomChanged = false;
    if (fromKey < cin) {
      fromKey = cin;
      fromChanged = true;
    }
    if (toKey > cout) {
      toKey = cout;
      toChanged = true;
    }
    let roomId = slice.roomId;
    if (!input.datesOnly && !roomId && input.roomId) {
      roomId = input.roomId;
      roomChanged = true;
    }
    working.push({
      id: slice.id,
      fromKey,
      toKey,
      roomId,
      roomTypeId: slice.roomTypeId,
      ratePlanId: slice.ratePlanId,
      fromChanged,
      toChanged,
      roomChanged,
    });
  }

  const creates: AlignSliceCreate[] = [];
  if (!input.datesOnly) {
    if (working.length === 0) {
      creates.push({
        fromDate: bakuCivilUtcDate(cin),
        toDate: bakuCivilUtcDate(cout),
        roomId: input.roomId,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
      });
    } else {
      const maxTo = working.reduce((max, slice) => (slice.toKey > max ? slice.toKey : max), cin);
      if (maxTo < cout) {
        const tail = working
          .filter((slice) => slice.toKey === maxTo)
          .sort((a, b) => (a.fromKey < b.fromKey ? 1 : -1))[0];
        if (tail && tail.roomId === input.roomId) {
          tail.toKey = cout;
          tail.toChanged = true;
        }
      }
      const ordered = [...working].sort((a, b) => (a.fromKey < b.fromKey ? -1 : 1));
      let cursor = cin;
      for (const slice of ordered) {
        if (slice.fromKey > cursor) {
          creates.push({
            fromDate: bakuCivilUtcDate(cursor),
            toDate: bakuCivilUtcDate(slice.fromKey),
            roomId: input.roomId,
            roomTypeId: slice.roomTypeId,
            ratePlanId: slice.ratePlanId,
          });
        }
        if (slice.toKey > cursor) cursor = slice.toKey;
      }
      if (cursor < cout) {
        const prev = [...ordered].reverse().find((slice) => slice.toKey <= cursor) ?? ordered[0];
        creates.push({
          fromDate: bakuCivilUtcDate(cursor),
          toDate: bakuCivilUtcDate(cout),
          roomId: input.roomId,
          roomTypeId: prev?.roomTypeId ?? input.roomTypeId,
          ratePlanId: prev?.ratePlanId ?? input.ratePlanId,
        });
      }
    }
  }

  const updates: AlignSliceUpdate[] = [];
  for (const slice of working) {
    if (!slice.fromChanged && !slice.toChanged && !slice.roomChanged) continue;
    updates.push({
      id: slice.id,
      ...(slice.fromChanged ? { fromDate: bakuCivilUtcDate(slice.fromKey) } : {}),
      ...(slice.toChanged ? { toDate: bakuCivilUtcDate(slice.toKey) } : {}),
      ...(slice.roomChanged ? { roomId: slice.roomId } : {}),
    });
  }

  return { updates, deletes, creates };
}

export type RateRetariffUpdate = {
  id: string;
  toDate?: Date;
  ratePlanId?: string;
};

/**
 * Move slices that still carry the previous tariff onto the new one from `fromKey`.
 * Nights before that key stay on the old plan. Charged roomTypeId is not rewritten.
 * A slice on a different plan is an intentional segment and is left alone.
 */
export function planRatePlanRetariff(input: {
  slices: AlignSlice[];
  previousRatePlanId: string;
  nextRatePlanId: string;
  fromKey: string;
  checkOutKey: string;
  roomTypeId: string;
  roomId: string | null;
}): { updates: RateRetariffUpdate[]; creates: AlignSliceCreate[] } {
  if (input.previousRatePlanId === input.nextRatePlanId) {
    return { updates: [], creates: [] };
  }
  if (input.fromKey >= input.checkOutKey) return { updates: [], creates: [] };

  const updates: RateRetariffUpdate[] = [];
  const creates: AlignSliceCreate[] = [];
  let covered = false;

  for (const slice of input.slices) {
    if (slice.ratePlanId !== input.previousRatePlanId) continue;
    const from = hotelDateKey(slice.fromDate);
    const to = hotelDateKey(slice.toDate);
    if (to <= input.fromKey || from >= input.checkOutKey) continue;
    const endKey = to > input.checkOutKey ? input.checkOutKey : to;
    if (from < input.fromKey) {
      updates.push({ id: slice.id, toDate: bakuCivilUtcDate(input.fromKey) });
      creates.push({
        fromDate: bakuCivilUtcDate(input.fromKey),
        toDate: bakuCivilUtcDate(endKey),
        roomId: slice.roomId,
        roomTypeId: slice.roomTypeId,
        ratePlanId: input.nextRatePlanId,
      });
    } else {
      updates.push({
        id: slice.id,
        ratePlanId: input.nextRatePlanId,
        ...(endKey !== to ? { toDate: bakuCivilUtcDate(endKey) } : {}),
      });
    }
    covered = true;
  }

  const openCovered = input.slices.some((slice) => {
    const from = hotelDateKey(slice.fromDate);
    const to = hotelDateKey(slice.toDate);
    return from <= input.fromKey && input.fromKey < to;
  });
  if (!covered && !openCovered) {
    creates.push({
      fromDate: bakuCivilUtcDate(input.fromKey),
      toDate: bakuCivilUtcDate(input.checkOutKey),
      roomId: input.roomId,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.nextRatePlanId,
    });
  }

  return { updates, creates };
}
