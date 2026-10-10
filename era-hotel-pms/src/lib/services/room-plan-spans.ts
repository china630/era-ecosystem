export type PlanSlice = {
  id: string;
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
};

export type PlanRoomChange = {
  fromRoomId: string | null;
  effectiveAt: Date;
};

export type PlanSpan = {
  key: string;
  roomId: string;
  from: Date;
  to: Date;
};

/**
 * One painted bar per slice. A slice without a door keeps the room it left
 * when a later slice took the reservation's current door (room-change from-room
 * on the split date). Otherwise the reservation door is used when no sibling
 * slice already holds it.
 */
export function roomPlanSpans(input: {
  reservationId: string;
  roomId: string | null;
  checkIn: Date;
  checkOut: Date;
  slices: PlanSlice[];
  changes: PlanRoomChange[];
  dayKey: (date: Date) => string;
}): { placed: PlanSpan[]; unplaced: PlanSlice[] } {
  const slices = input.slices;
  if (slices.length === 0) {
    return input.roomId
      ? {
          placed: [
            {
              key: input.reservationId,
              roomId: input.roomId,
              from: input.checkIn,
              to: input.checkOut,
            },
          ],
          unplaced: [],
        }
      : { placed: [], unplaced: [] };
  }

  const taken = new Set(slices.map((slice) => slice.roomId).filter((id): id is string => Boolean(id)));
  const placed: PlanSpan[] = [];
  const unplaced: PlanSlice[] = [];

  for (const slice of slices) {
    let roomId = slice.roomId;
    if (!roomId) {
      const split = input.changes.find(
        (change) =>
          Boolean(change.fromRoomId) &&
          !taken.has(change.fromRoomId as string) &&
          input.dayKey(change.effectiveAt) === input.dayKey(slice.toDate),
      );
      if (split?.fromRoomId) roomId = split.fromRoomId;
      else if (input.roomId && !taken.has(input.roomId)) roomId = input.roomId;
    }
    if (!roomId) {
      unplaced.push(slice);
      continue;
    }
    taken.add(roomId);
    placed.push({
      key: `${input.reservationId}:${slice.id}`,
      roomId,
      from: slice.fromDate,
      to: slice.toDate,
    });
  }

  return { placed, unplaced };
}
