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

export type DoorSliceTemplate = {
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

/**
 * Nights from `effective` through checkout that no slice covers, placed on the
 * destination door. A slice that already ended before the move does not count.
 * Does not rewrite history before `effective`.
 */
export function forwardDoorGaps(input: {
  slices: DoorSlice[];
  updates: DoorSliceUpdate[];
  creates: DoorSliceCreate[];
  effective: Date;
  checkOut: Date;
  toRoomId: string | null;
  dayKey: (date: Date) => string;
  template?: DoorSliceTemplate;
}): DoorSliceCreate[] {
  if (!input.toRoomId) return [];
  const effectiveKey = input.dayKey(input.effective);
  const checkoutKey = input.dayKey(input.checkOut);
  if (effectiveKey >= checkoutKey) return [];

  const byId = new Map(input.updates.map((update) => [update.id, update]));
  const projected: DoorSliceCreate[] = input.slices.map((slice) => {
    const update = byId.get(slice.id);
    return {
      fromDate: slice.fromDate,
      toDate: update?.toDate ?? slice.toDate,
      roomId: update?.roomId !== undefined ? update.roomId : slice.roomId,
      roomTypeId: slice.roomTypeId,
      ratePlanId: slice.ratePlanId,
    };
  });
  projected.push(...input.creates);

  const last = [...input.slices].sort((a, b) => b.toDate.getTime() - a.toDate.getTime())[0];
  const template = last
    ? { roomTypeId: last.roomTypeId, ratePlanId: last.ratePlanId }
    : input.template;
  if (!template) return [];

  const gaps: DoorSliceCreate[] = [];
  let cursor = effectiveKey;
  for (let guard = 0; cursor < checkoutKey && guard < 400; guard += 1) {
    const cover = projected.find(
      (slice) => input.dayKey(slice.fromDate) <= cursor && input.dayKey(slice.toDate) > cursor,
    );
    if (cover) {
      const next = input.dayKey(cover.toDate);
      if (next <= cursor) break;
      cursor = next;
      continue;
    }
    const nextStart = projected
      .map((slice) => input.dayKey(slice.fromDate))
      .filter((key) => key > cursor && key < checkoutKey)
      .sort()[0];
    const toKey = nextStart ?? checkoutKey;
    const gap: DoorSliceCreate = {
      fromDate: civilDay(cursor),
      toDate: civilDay(toKey),
      roomId: input.toRoomId,
      roomTypeId: template.roomTypeId,
      ratePlanId: template.ratePlanId,
    };
    gaps.push(gap);
    projected.push(gap);
    cursor = toKey;
  }
  return gaps;
}

function civilDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
