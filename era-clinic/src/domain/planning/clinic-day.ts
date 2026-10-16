import { getCalendarDay } from "@era/satellite-kit";
import { addBakuDays, bakuDateKey, bakuDayBounds } from "@/lib/baku-day";
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
 * Layer, highest wins: manual override, production-calendar exception, week template.
 * Weekday end, Saturday end, and shortened-day end come from clinic settings.
 * A weekday in closedWeekdays stays off unless the country calendar opens it.
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
    const country = await getCalendarDay(ymd);
    const countryHoliday = country?.dayType === "holiday" || country?.dayType === "mourning";
    const saturdayStaysOpen = weekday === 6 && !closed.has(6);
    const countryClosed = country?.isWorking === false && !saturdayStaysOpen;
    if (countryHoliday || countryClosed) {
      days.push({ ymd, working: false, endHour: 0 });
      continue;
    }
    if (country?.dayType === "shortened") {
      days.push({ ymd, working: true, endHour: shortEnd });
      continue;
    }
    if (closed.has(weekday)) {
      const opened = country?.isWorking === true;
      const end = weekday === 6 ? saturdayEnd : weekdayEnd;
      days.push({ ymd, working: opened, endHour: opened ? end : 0 });
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
