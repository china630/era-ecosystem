import {
  getCalendarDay,
  type CalendarDayType,
} from "@era/satellite-kit";

const SHORTENED_END_HOUR = 13;

export async function isElectiveSchedulingAllowed(date: Date): Promise<boolean> {
  const iso = date.toISOString().slice(0, 10);
  const day = await getCalendarDay(iso);
  if (!day) return true;
  if (day.dayType === "mourning") return false;
  if (!day.isWorking) return false;
  return true;
}

export async function resolveSchedulingEndHour(date: Date): Promise<number> {
  const iso = date.toISOString().slice(0, 10);
  const day = await getCalendarDay(iso);
  if (day?.dayType === ("shortened" as CalendarDayType)) {
    return SHORTENED_END_HOUR;
  }
  return 17;
}

export async function nextSchedulingDay(from: Date): Promise<Date> {
  let cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 366; i++) {
    if (await isElectiveSchedulingAllowed(cursor)) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}
