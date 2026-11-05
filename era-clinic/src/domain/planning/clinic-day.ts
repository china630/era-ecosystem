import { getCalendarDay } from "@era/satellite-kit";
import { addBakuDays, bakuDateKey, bakuDayBounds, bakuHourMinute, parseBakuDateTime } from "@/lib/baku-day";
import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import type { ClinicDayKind, DayBoundary } from "@/domain/planning/procedure-day-window";

export type ClinicDay = DayBoundary & {
  /** kind !== closed */
  working: boolean;
  /** Manual override row exists for this civil day. */
  overridden: boolean;
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

function toClinicDay(
  ymd: string,
  kind: ClinicDayKind,
  startHour: number,
  endHour: number,
  overridden: boolean,
): ClinicDay {
  if (kind === "closed") {
    return { ymd, kind, working: false, startHour: 0, endHour: 0, overridden };
  }
  return {
    ymd,
    kind,
    working: true,
    startHour,
    endHour: Math.max(endHour, startHour),
    overridden,
  };
}

/**
 * Stay days from check-in inclusive through the day before checkout.
 * Layer, highest wins: manual clinic-day override, then the week template
 * (`closedWeekdays`). The country calendar may close an otherwise open day
 * (holiday / mourning / isWorking false) but must not open a closed weekday.
 * Saturday is a short day (uses shortenedDay* hours). Saturday end column is ignored.
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
  const workStart = settings.dayStartHour;
  const workEnd = settings.dayEndHour;
  const shortStart = settings.shortenedDayStartHour;
  const shortEnd = settings.shortenedDayEndHour;
  const days: ClinicDay[] = [];
  for (const ymd of ymds) {
    const weekday = bakuWeekday(ymd);
    const override = byDay.get(ymd);
    if (override) {
      const kind: ClinicDayKind =
        override.closed || override.dayKind === "CLOSED"
          ? "closed"
          : override.dayKind === "SHORT"
            ? "short"
            : "working";
      if (kind === "closed") {
        days.push(toClinicDay(ymd, "closed", 0, 0, true));
        continue;
      }
      const defaultStart = kind === "short" ? shortStart : workStart;
      const defaultEnd = kind === "short" ? shortEnd : workEnd;
      days.push(
        toClinicDay(
          ymd,
          kind,
          override.startHour ?? defaultStart,
          override.endHour ?? defaultEnd,
          true,
        ),
      );
      continue;
    }
    if (closed.has(weekday)) {
      days.push(toClinicDay(ymd, "closed", 0, 0, false));
      continue;
    }
    const country = await getCalendarDay(ymd);
    const countryHoliday = country?.dayType === "holiday" || country?.dayType === "mourning";
    const saturdayStaysOpen = weekday === 6;
    const countryClosed = country?.isWorking === false && !saturdayStaysOpen;
    if (countryHoliday || countryClosed) {
      days.push(toClinicDay(ymd, "closed", 0, 0, false));
      continue;
    }
    if (country?.dayType === "shortened" || weekday === 6) {
      days.push(toClinicDay(ymd, "short", shortStart, shortEnd, false));
      continue;
    }
    days.push(toClinicDay(ymd, "working", workStart, workEnd, false));
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

/** Saxla start day. Yesterday is allowed. Anything older snaps back to today. */
export function notBeforeYmdFromStart(startAt: Date | null | undefined, todayYmd: string): string {
  if (!startAt || Number.isNaN(startAt.getTime())) return todayYmd;
  const ymd = bakuDateKey(startAt);
  if (ymd >= todayYmd) return ymd;
  const yesterday = addBakuDays(todayYmd, -1);
  return ymd === yesterday ? yesterday : todayYmd;
}

/**
 * Later Saxla, when the dialog is not shown again.
 * Before the remembered hour, search from that hour. Once the clock has reached it, search from the current hour.
 * A passed morning stays closed. No remembered hour means the current hour, not clinic open.
 */
export function saxlaRepeatClock(input: {
  now: Date;
  rememberedHour: number | null;
  dayStartHour: number;
  dayEndHour: number;
}): Date {
  const nowHour = bakuHourMinute(input.now).hour;
  const remembered =
    input.rememberedHour != null && input.rememberedHour >= 0 && input.rememberedHour <= 23
      ? input.rememberedHour
      : null;
  let hour = Math.max(remembered ?? nowHour, nowHour, input.dayStartHour);
  let ymd = bakuDateKey(input.now);
  if (hour >= input.dayEndHour) {
    ymd = addBakuDays(ymd, 1);
    hour = input.dayStartHour;
  }
  return parseBakuDateTime(ymd, `${String(hour).padStart(2, "0")}:00`);
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
