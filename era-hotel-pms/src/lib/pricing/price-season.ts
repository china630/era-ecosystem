/** Inclusive civil ranges. A shared day is an overlap. */
export function seasonRangesOverlap(
  a: { startsOn: string; endsOn: string },
  b: { startsOn: string; endsOn: string },
): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

export function seasonDateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
