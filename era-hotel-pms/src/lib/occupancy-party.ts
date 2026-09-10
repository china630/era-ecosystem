export type OccupancyCounts = {
  adults: number;
  children11_6: number;
  children5_2: number;
  children1_0: number;
};

/** Map a departing pax to which occupancy counter to decrement (Nafta child bands). */
export function occupancyBucketForPax(pax: {
  age?: number | null;
}): keyof OccupancyCounts {
  const age = pax.age == null ? null : Number(pax.age);
  if (age == null || Number.isNaN(age) || age >= 12) return 'adults';
  if (age >= 6) return 'children11_6';
  if (age >= 2) return 'children5_2';
  return 'children1_0';
}

export function decrementOccupancy(
  current: OccupancyCounts,
  bucket: keyof OccupancyCounts,
): OccupancyCounts {
  return {
    ...current,
    [bucket]: Math.max(0, current[bucket] - 1),
  };
}

export function countLivePax(
  pax: Array<{ id: string; departedAt?: Date | null }>,
  excludingId?: string,
): number {
  return pax.filter((p) => !p.departedAt && p.id !== excludingId).length;
}

export function previewOccupancyAfterDepart(
  current: OccupancyCounts,
  pax: { age?: number | null },
): OccupancyCounts {
  const next = decrementOccupancy(current, occupancyBucketForPax(pax));
  if (next.adults < 1 && next.children11_6 + next.children5_2 + next.children1_0 < 1) {
    next.adults = 1;
  }
  return next;
}
