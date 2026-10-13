export type DoorSlice = {
  id: string;
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
};

export type DoorSliceUpdate = {
  id: string;
  toDate?: Date;
  roomId?: string | null;
};

export type DoorSliceCreate = {
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
};

/**
 * Move the door on stay slices from `effective` forward.
 * Nights before that date stay on the old door. A slice with no door follows
 * the reservation header and is left alone. A pending future door is kept.
 */
export function planDoorMove(input: {
  slices: DoorSlice[];
  fromRoomId: string;
  toRoomId: string | null;
  effective: Date;
  keepRoomIds?: string[];
  dayKey: (date: Date) => string;
}): { updates: DoorSliceUpdate[]; creates: DoorSliceCreate[] } {
  const effectiveKey = input.dayKey(input.effective);
  const keep = new Set(input.keepRoomIds ?? []);
  const updates: DoorSliceUpdate[] = [];
  const creates: DoorSliceCreate[] = [];

  for (const slice of input.slices) {
    if (!slice.roomId || slice.roomId === input.toRoomId) continue;
    if (slice.roomId !== input.fromRoomId) continue;
    if (keep.has(slice.roomId)) continue;
    if (input.dayKey(slice.toDate) <= effectiveKey) continue;

    if (input.dayKey(slice.fromDate) >= effectiveKey) {
      updates.push({ id: slice.id, roomId: input.toRoomId });
      continue;
    }

    updates.push({ id: slice.id, toDate: input.effective });
    creates.push({
      fromDate: input.effective,
      toDate: slice.toDate,
      roomId: input.toRoomId,
      roomTypeId: slice.roomTypeId,
      ratePlanId: slice.ratePlanId,
    });
  }

  return { updates, creates };
}
