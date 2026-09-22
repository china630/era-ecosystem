import {
  getCalendarDay,
} from "@era/satellite-kit";
import type { CalendarDayType } from "@era/contracts";
import { bakuDateKey, bakuDayBounds } from "@/lib/baku-day";

const SHORTENED_END_HOUR = 13;

function addBakuDays(ymd: string, days: number): string {
  const { start } = bakuDayBounds(ymd);
  return bakuDateKey(new Date(start.getTime() + days * 86_400_000));
}

export async function isElectiveSchedulingAllowed(date: Date): Promise<boolean> {
  const iso = bakuDateKey(date);
  const day = await getCalendarDay(iso);
  if (!day) return true;
  if (day.dayType === "mourning") return false;
  if (!day.isWorking) return false;
  return true;
}

export async function resolveSchedulingEndHour(date: Date): Promise<number> {
  const iso = bakuDateKey(date);
  const day = await getCalendarDay(iso);
  if (day?.dayType === ("shortened" as CalendarDayType)) {
    return SHORTENED_END_HOUR;
  }
  return 17;
}

export async function nextSchedulingDay(from: Date): Promise<Date> {
  let ymd = bakuDateKey(from);
  for (let i = 0; i < 366; i++) {
    const { start: cursor } = bakuDayBounds(ymd);
    if (await isElectiveSchedulingAllowed(cursor)) return cursor;
    ymd = addBakuDays(ymd, 1);
  }
  return bakuDayBounds(ymd).start;
}
