/**
 * Civil YYYY-MM-DD weekday helpers for buffet week templates (Asia/Baku calendar).
 * ISO weekday: 1=Monday … 7=Sunday.
 */
import { bakuCivilUtcDate } from "@era/satellite-kit/time";

export function isoWeekdayFromYmd(ymd: string): number {
  const js = bakuCivilUtcDate(ymd).getUTCDay(); // 0=Sun … 6=Sat
  return js === 0 ? 7 : js;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = bakuCivilUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (ISO) of the week that contains `ymd`. */
export function mondayOfWeekYmd(ymd: string): string {
  const wd = isoWeekdayFromYmd(ymd);
  return addDaysYmd(ymd, 1 - wd);
}

export function ymdForWeekday(weekMondayYmd: string, weekday: number): string {
  if (weekday < 1 || weekday > 7) {
    throw new Error("weekday must be 1..7");
  }
  if (isoWeekdayFromYmd(weekMondayYmd) !== 1) {
    throw new Error("weekMondayYmd must be a Monday");
  }
  return addDaysYmd(weekMondayYmd, weekday - 1);
}

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];
