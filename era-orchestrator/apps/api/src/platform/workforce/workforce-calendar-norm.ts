export type CalendarDayInput = {
  date: string;
  dayType?: string | null;
  isWorking?: boolean | null;
};

export type WorkRegime = "FIVE_DAY" | "SIX_DAY" | "MEDICAL" | "CUSTOM";

export type CalendarSummary = {
  workDays: number;
  offDays: number;
  holidays: number;
  days: Array<{ date: string; dayType: string; isWorking: boolean }>;
};

const OFF_TYPES = new Set(["weekend", "holiday", "mourning", "transferred_rest"]);

function isoDow(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
}

function monthDates(year: number, month: number): string[] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  return out;
}

function fallbackDay(iso: string): { dayType: string; isWorking: boolean } {
  const dow = isoDow(iso);
  const weekend = dow === 0 || dow === 6;
  return { dayType: weekend ? "weekend" : "working", isWorking: !weekend };
}

/** Merge data-hub days with a Sat/Sun fallback when the hub has no row. */
export function summarizeCalendar(
  year: number,
  month: number,
  hubDays: CalendarDayInput[],
): CalendarSummary {
  const byDate = new Map<string, CalendarDayInput>();
  for (const row of hubDays) {
    const date = row.date?.slice(0, 10);
    if (date) byDate.set(date, row);
  }
  const days = monthDates(year, month).map((date) => {
    const hub = byDate.get(date);
    if (!hub) return { date, ...fallbackDay(date) };
    const dayType = (hub.dayType ?? "").trim() || (hub.isWorking ? "working" : "weekend");
    const isWorking =
      hub.isWorking != null
        ? Boolean(hub.isWorking)
        : !OFF_TYPES.has(dayType);
    return { date, dayType, isWorking };
  });
  let workDays = 0;
  let holidays = 0;
  for (const day of days) {
    if (day.isWorking) workDays += 1;
    if (day.dayType === "holiday" || day.dayType === "mourning") holidays += 1;
  }
  return {
    workDays,
    offDays: days.length - workDays,
    holidays,
    days,
  };
}

function workingForRegime(
  day: { date: string; dayType: string; isWorking: boolean },
  regime: WorkRegime,
): boolean {
  if (day.dayType === "holiday" || day.dayType === "mourning" || day.dayType === "transferred_rest") {
    return false;
  }
  if (day.dayType === "transferred_working" || day.dayType === "shortened") return true;
  if (regime === "SIX_DAY") {
    const dow = isoDow(day.date);
    if (dow === 0) return false;
    if (dow === 6) return day.dayType !== "holiday";
    return day.isWorking || day.dayType === "working";
  }
  return day.isWorking;
}

const DAYS_PER_WEEK: Record<WorkRegime, number> = {
  FIVE_DAY: 5,
  SIX_DAY: 6,
  MEDICAL: 5,
  CUSTOM: 5,
};

/** Hour norm for the month. Null when the org has not set weekly hours for the regime. */
export function monthHourNorm(
  regime: WorkRegime | null | undefined,
  weeklyHours: number | null | undefined,
  days: CalendarSummary["days"],
): number | null {
  if (!regime || weeklyHours == null || !(weeklyHours > 0)) return null;
  const working = days.filter((d) => workingForRegime(d, regime)).length;
  const perDay = weeklyHours / DAYS_PER_WEEK[regime];
  return Math.round(working * perDay * 100) / 100;
}

export function weeklyHoursForRegime(
  regime: WorkRegime | null | undefined,
  settings: {
    fiveDayWeeklyHours?: number | null;
    sixDayWeeklyHours?: number | null;
    medicalWeeklyHours?: number | null;
    customWeeklyHours?: number | null;
  } | null,
): number | null {
  if (!regime || !settings) return null;
  const raw =
    regime === "FIVE_DAY"
      ? settings.fiveDayWeeklyHours
      : regime === "SIX_DAY"
        ? settings.sixDayWeeklyHours
        : regime === "MEDICAL"
          ? settings.medicalWeeklyHours
          : settings.customWeeklyHours;
  if (raw == null || !(Number(raw) > 0)) return null;
  return Number(raw);
}
