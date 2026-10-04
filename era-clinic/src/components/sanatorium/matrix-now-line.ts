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
  const nowMin = wallMinutes(now);
  const firstMin = wallMinutes(slotTimes[0]);
  const lastMin = wallMinutes(slotTimes[slotTimes.length - 1]);
  const tailStep =
    slotTimes.length >= 2
      ? Math.max(1, lastMin - wallMinutes(slotTimes[slotTimes.length - 2]))
      : 5;
  if (nowMin < firstMin || nowMin > lastMin + tailStep) return null;

  let cols = 0;
  for (let i = 0; i < slotTimes.length; i++) {
    const start = wallMinutes(slotTimes[i]);
    const end =
      i + 1 < slotTimes.length ? wallMinutes(slotTimes[i + 1]) : start + tailStep;
    if (nowMin <= end || i === slotTimes.length - 1) {
      const span = Math.max(1, end - start);
      cols = i + (nowMin - start) / span;
      break;
    }
  }
  return `calc(${LABEL_COLUMN} + ${cols} * ${slotColumnWidth})`;
}
