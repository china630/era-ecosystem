export type SliceWindow = {
  fromDate: string;
  toDate: string;
  roomTypeId: string;
  ratePlanId: string;
};

/** from inclusive, to exclusive. */
export function nextSlicesAfterProductChange(
  existing: SliceWindow[],
  fromDate: string,
  checkOutDate: string,
  roomTypeId: string,
  ratePlanId: string,
): SliceWindow[] {
  const kept: SliceWindow[] = [];
  for (const slice of existing) {
    if (slice.toDate <= fromDate) {
      kept.push(slice);
      continue;
    }
    if (slice.fromDate >= fromDate) continue;
    kept.push({ ...slice, toDate: fromDate });
  }
  kept.push({ fromDate, toDate: checkOutDate, roomTypeId, ratePlanId });
  return kept;
}
