import { getCalendarDay } from "@era/satellite-kit";
import { addBakuDays, bakuDateKey, bakuDayBounds, bakuHourMinute, parseBakuDateTime } from "@/lib/baku-day";
import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";

export type ClinicDay = {
  ymd: string;
  working: boolean;
  /** Last bookable hour. Saturday and a shortened production day end at 13. */
  endHour: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function bakuWeekday(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  const noon = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baku",
    weekday: "short",
  }).format(noon);
  return WEEKDAY[short] ?? 0;
}

function eachYmd(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let cursor = fromYmd;
  while (cursor < toYmd) {
    out.push(cursor);
    cursor = addBakuDays(cursor, 1);
  }
  return out;
}

/**
 * Stay days from check-in inclusive through the day before checkout.
 * Layer, highest wins: manual clinic-day override, then the week template
 * (`closedWeekdays`). The country calendar may close an otherwise open day
 * (holiday / mourning / isWorking false) but must not open a closed weekday.
 * Weekday end, Saturday end, and shortened-day end come from clinic settings.
 */
export async function listClinicDays(fromYmd: string, toYmd: string): Promise<ClinicDay[]> {
  const ymds = eachYmd(fromYmd, toYmd);
  const [overrides, settings] = await Promise.all([
    prisma.clinicDayOverride.findMany({
      where: { dayYmd: { in: ymds } },
    }),
    getSchedulingSettings(),
  ]);
  const byDay = new Map(overrides.map((row) => [row.dayYmd, row]));
  const closed = new Set(settings.closedWeekdays);
  const weekdayEnd = settings.dayEndHour;
  const saturdayEnd = settings.saturdayEndHour;
  const shortEnd = settings.shortenedDayEndHour;
  const days: ClinicDay[] = [];
  for (const ymd of ymds) {
    const weekday = bakuWeekday(ymd);
    const override = byDay.get(ymd);
    if (override) {
      days.push({
        ymd,
        working: !override.closed,
        endHour: override.endHour ?? (override.closed ? 0 : weekday === 6 ? saturdayEnd : weekdayEnd),
      });
      continue;
    }
    if (closed.has(weekday)) {
      days.push({ ymd, working: false, endHour: 0 });
      continue;
    }
    const country = await getCalendarDay(ymd);
    const countryHoliday = country?.dayType === "holiday" || country?.dayType === "mourning";
    const saturdayStaysOpen = weekday === 6;
    const countryClosed = country?.isWorking === false && !saturdayStaysOpen;
    if (countryHoliday || countryClosed) {
      days.push({ ymd, working: false, endHour: 0 });
      continue;
    }
    if (country?.dayType === "shortened") {
      days.push({ ymd, working: true, endHour: shortEnd });
      continue;
    }
    if (weekday === 6) {
      days.push({ ymd, working: true, endHour: saturdayEnd });
      continue;
    }
    days.push({ ymd, working: true, endHour: weekdayEnd });
  }
  return days;
}

export function stayYmd(startsOn: Date, endsOn: Date): { fromYmd: string; toYmd: string } {
  return { fromYmd: bakuDateKey(startsOn), toYmd: bakuDateKey(endsOn) };
}

export function dayStartInstant(ymd: string, hour: number): Date {
  const { start } = bakuDayBounds(ymd);
  return new Date(start.getTime() + hour * 3_600_000);
}

/** Saxla start date, not earlier than today. Same door for baths and physio. */
export function notBeforeYmdFromStart(startAt: Date | null | undefined, todayYmd: string): string {
  if (!startAt || Number.isNaN(startAt.getTime())) return todayYmd;
  const ymd = bakuDateKey(startAt);
  return ymd < todayYmd ? todayYmd : ymd;
}

/** First series day keeps the Saxla hour when the start day is closed or shifted. */
export function saxlaFirstClock(
  startAt: Date | null | undefined,
  firstYmd: string,
  fallbackHour: number,
): Date {
  const hour =
    startAt && !Number.isNaN(startAt.getTime()) ? bakuHourMinute(startAt).hour : fallbackHour;
  const hh = `${String(hour).padStart(2, "0")}:00`;
  if (startAt && !Number.isNaN(startAt.getTime()) && bakuDateKey(startAt) === firstYmd) {
    return startAt;
  }
  return parseBakuDateTime(firstYmd, hh);
}

/** First working clinic day on or after fromYmd. */
export function nextWorkingYmd(days: ClinicDay[], fromYmd: string): string | null {
  for (const day of days) {
    if (day.ymd >= fromYmd && day.working) return day.ymd;
  }
  return null;
}
