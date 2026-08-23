import { bakuDateKey } from "@/domain/patient/patient-timeline.service";

/** Asia/Baku is UTC+4 year-round (no DST). */
const BAKU_OFFSET = "+04:00";

export function todayBakuYmd(asOf = new Date()): string {
  return bakuDateKey(asOf);
}

/** UTC instant range covering one Asia/Baku calendar day. */
export function bakuDayBounds(dateYmd: string): { start: Date; end: Date; date: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  const start = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00${BAKU_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date: `${m[1]}-${m[2]}-${m[3]}` };
}

export const bakuDayRange = bakuDayBounds;
