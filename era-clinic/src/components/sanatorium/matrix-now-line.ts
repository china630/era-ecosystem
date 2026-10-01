import { bakuHourMinute } from "@/lib/baku-day";

const LABEL_COLUMN = "10rem";

function wallMinutes(isoOrDate: Date | string): number {
  const { hour, minute } = bakuHourMinute(isoOrDate);
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

/**
 * Now-marker offset in the time grid.
 * Columns are a fixed width; do not place the line as a percent of the card
 * (the card is often wider than the grid, which shifts the marker later).
 */
export function matrixNowLineLeft(args: {
  slotTimes: string[];
  now: Date | string;
  slotColumnWidth: string;
}): string | null {
  const { slotTimes, now, slotColumnWidth } = args;
  if (slotTimes.length === 0) return null;
  const startMin = wallMinutes(slotTimes[0]);
  const step =
    slotTimes.length >= 2 ? wallMinutes(slotTimes[1]) - wallMinutes(slotTimes[0]) : 5;
  if (!(step > 0)) return null;
  const endMin = wallMinutes(slotTimes[slotTimes.length - 1]) + step;
  const nowMin = wallMinutes(now);
  if (nowMin < startMin || nowMin > endMin) return null;
  const cols = (nowMin - startMin) / step;
  return `calc(${LABEL_COLUMN} + ${cols} * ${slotColumnWidth})`;
}
