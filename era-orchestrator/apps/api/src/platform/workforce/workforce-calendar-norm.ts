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

const REGIMES = new Set<WorkRegime>(["FIVE_DAY", "SIX_DAY", "MEDICAL", "CUSTOM"]);

/** Employment regime overrides the position. Hours stay on the position, then the org. */
export function resolveRegimeHours(input: {
  employmentRegime?: string | null;
  positionRegime?: string | null;
  positionWeeklyHours?: number | null;
  org: {
    fiveDayWeeklyHours?: number | null;
    sixDayWeeklyHours?: number | null;
    medicalWeeklyHours?: number | null;
    customWeeklyHours?: number | null;
  } | null;
}): { regime: WorkRegime | null; weeklyHours: number | null } {
  const raw = input.employmentRegime || input.positionRegime || null;
  const regime = raw && REGIMES.has(raw as WorkRegime) ? (raw as WorkRegime) : null;
  if (!regime) return { regime: null, weeklyHours: null };
  const fromPosition = input.positionWeeklyHours;
  const weeklyHours =
    fromPosition != null && fromPosition > 0
      ? fromPosition
      : weeklyHoursForRegime(regime, input.org);
  return { regime, weeklyHours };
}

/**
 * Work year that contains `onYmd`, measured from the hire-date anniversary.
 * Display only. The remaining-day number stays in Finance.
 */
export function workYearContaining(
  hireYmd: string | null | undefined,
  onYmd: string,
): { from: string; to: string } | null {
  const hire = hireYmd?.slice(0, 10) ?? "";
  const on = onYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hire) || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return null;
  const [, month, day] = hire.split("-").map(Number);
  const [onYear] = on.split("-").map(Number);
  const anniversary = (year: number) => {
    const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const clamped = Math.min(day, dim);
    return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
  };
  const thisYear = anniversary(onYear);
  const startYear = on >= thisYear ? onYear : onYear - 1;
  const from = anniversary(startYear);
  const next = new Date(`${anniversary(startYear + 1)}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return { from, to: next.toISOString().slice(0, 10) };
}

function addUtcDays(iso: string, delta: number): string {
  const dt = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function dayIsWorking(iso: string, hubDays: CalendarDayInput[]): boolean {
  const hub = hubDays.find((row) => row.date?.slice(0, 10) === iso);
  if (hub) {
    if (hub.isWorking != null) return Boolean(hub.isWorking);
    const dayType = (hub.dayType ?? "").trim();
    if (OFF_TYPES.has(dayType)) return false;
    if (dayType === "working" || dayType === "transferred_working" || dayType === "shortened") {
      return true;
    }
  }
  const dow = isoDow(iso);
  return dow !== 0 && dow !== 6;
}

/**
 * Next occurrence of payDay on or after today. A non-working day moves to the
 * previous working day (data-hub when present, otherwise Saturday/Sunday).
 */
export function nextPlannedPayDate(
  todayYmd: string,
  payDay: number,
  hubDays: CalendarDayInput[] = [],
): string {
  const today = todayYmd.slice(0, 10);
  const [year0, month0, day0] = today.split("-").map(Number);
  const wanted = Math.min(31, Math.max(1, Math.floor(payDay)));
  let year = year0;
  let month = month0;
  const thisLast = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day0 > Math.min(wanted, thisLast)) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let cursor = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(wanted, last)).padStart(2, "0")}`;
  for (let i = 0; i < 16; i += 1) {
    if (dayIsWorking(cursor, hubDays)) return cursor;
    cursor = addUtcDays(cursor, -1);
  }
  return cursor;
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
