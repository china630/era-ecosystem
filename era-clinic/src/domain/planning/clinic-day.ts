import { getCalendarDay } from "@era/satellite-kit";
import { addBakuDays, bakuDateKey, bakuDayBounds } from "@/lib/baku-day";
import { prisma } from "@/lib/prisma";

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
 * Ordinary Saturday stays a short working day. Sunday is off unless the country or the clinic opens it.
 */
export async function listClinicDays(fromYmd: string, toYmd: string): Promise<ClinicDay[]> {
  const ymds = eachYmd(fromYmd, toYmd);
  const overrides = await prisma.clinicDayOverride.findMany({
    where: { dayYmd: { in: ymds } },
  });
  const byDay = new Map(overrides.map((row) => [row.dayYmd, row]));
  const days: ClinicDay[] = [];
  for (const ymd of ymds) {
    const override = byDay.get(ymd);
    if (override) {
      days.push({
        ymd,
        working: !override.closed,
        endHour: override.endHour ?? (override.closed ? 0 : 17),
      });
      continue;
    }
    const country = await getCalendarDay(ymd);
    const weekday = bakuWeekday(ymd);
    const countryHoliday = country?.dayType === "holiday" || country?.dayType === "mourning";
    const countryClosed = country?.isWorking === false && weekday !== 6;
    if (countryHoliday || countryClosed) {
      days.push({ ymd, working: false, endHour: 0 });
      continue;
    }
    if (country?.dayType === "shortened") {
      days.push({ ymd, working: true, endHour: 13 });
      continue;
    }
    if (weekday === 0) {
      const workingSunday = country?.isWorking === true;
      days.push({ ymd, working: workingSunday, endHour: workingSunday ? 17 : 0 });
      continue;
    }
    if (weekday === 6) {
      days.push({ ymd, working: true, endHour: 13 });
      continue;
    }
    days.push({ ymd, working: true, endHour: 17 });
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
