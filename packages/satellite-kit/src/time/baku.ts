/**
 * Asia/Baku calendar helpers (UTC+4 year-round, no DST).
 * Import via `@era/satellite-kit/time` — not the main kit barrel.
 * ADR: docs/adr/asia-baku-clock.md
 */

export const ERA_TIME_ZONE = "Asia/Baku";
/** Alias for finance/orch drop-in (`baku-billing.util`). */
export const BAKU_TZ = ERA_TIME_ZONE;
const BAKU_OFFSET = "+04:00";

/** YYYY-MM-DD in Asia/Baku. Safe to import from client components. */
export function bakuDateKey(isoOrDate: Date | string = new Date()): string {
  if (typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate;
  }
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return String(isoOrDate).slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayBakuYmd(asOf = new Date()): string {
  return bakuDateKey(asOf);
}

/** Year / month / day parts in Asia/Baku. */
export function bakuYmd(d: Date = new Date()): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/** UTC instant range covering one Asia/Baku calendar day (half-open [start, end)). */
export function bakuDayBounds(dateYmd: string): { start: Date; end: Date; date: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  const start = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00${BAKU_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date: `${m[1]}-${m[2]}-${m[3]}` };
}

/**
 * UTC midnight of a civil YYYY-MM-DD — Prisma `@db.Date` equality / writes.
 * Not Baku wall midnight (that is `bakuDayBounds(ymd).start`).
 */
export function bakuCivilUtcDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  const instant = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  return instant;
}

/**
 * Wall clock in Asia/Baku → UTC instant.
 * `ymd` = YYYY-MM-DD; `hhmmss` = HH:MM or HH:MM:SS (normalized to HH:MM:SS).
 */
export function parseBakuDateTime(ymd: string, hhmmss: string): Date {
  const d = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  let t = String(hhmmss ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(t)) t = `${t}:00`;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) {
    throw new Error("Invalid time; use HH:MM or HH:MM:SS");
  }
  const instant = new Date(`${d}T${t}${BAKU_OFFSET}`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid Baku datetime: ${d} ${t}`);
  }
  return instant;
}

/** Hour (0-23) and minute in Asia/Baku. */
export function bakuHourMinute(isoOrDate: Date | string): { hour: number; minute: number } {
  const label = bakuTimeLabel(isoOrDate); // HH:MM
  const [hour, minute] = label.split(":").map(Number);
  return { hour, minute };
}

/** YYYY-MM-DD offset by whole Baku calendar days. */
export function addBakuDays(ymd: string, days: number): string {
  const { start } = bakuDayBounds(ymd);
  return bakuDateKey(new Date(start.getTime() + days * 86_400_000));
}

/** HH:MM in Asia/Baku. */
export function bakuTimeLabel(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** DD.MM.YYYY in Asia/Baku. */
export function bakuDateDisplay(isoOrDate: Date | string): string {
  const key = bakuDateKey(isoOrDate);
  const [y, m, day] = key.split("-");
  return `${day}.${m}.${y}`;
}

/** DD.MM in Asia/Baku (compact PLAN rows). */
export function bakuDateShort(isoOrDate: Date | string): string {
  const key = bakuDateKey(isoOrDate);
  const [, m, day] = key.split("-");
  return `${day}.${m}`;
}

/** `28.08 13:05` — date + time in Asia/Baku. */
export function bakuDateTimeLabel(isoOrDate: Date | string): string {
  return `${bakuDateShort(isoOrDate)} ${bakuTimeLabel(isoOrDate)}`;
}

/** `28.08.2026 18:36` — full date + time in Asia/Baku (24h). */
export function bakuDateTimeDisplay(isoOrDate: Date | string): string {
  return `${bakuDateDisplay(isoOrDate)} ${bakuTimeLabel(isoOrDate)}`;
}

/** `YYYY-MM` for the calendar month in Asia/Baku that contains `at`. */
export function billingPeriodKeyBaku(at = new Date()): string {
  const { y, m } = bakuYmd(at);
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Inclusive bounds for a Baku calendar month (`YYYY-MM`). */
export function bakuMonthBounds(periodKey: string): { from: Date; to: Date } {
  const [ys, ms] = periodKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const fromIso = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toIso = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;
  return { from: bakuInstantFromLocalIso(fromIso), to: bakuInstantFromLocalIso(toIso) };
}

/** Previous calendar month key in Baku relative to `at`. */
export function previousBillingPeriodKeyBaku(at = new Date()): string {
  const { y, m } = bakuYmd(at);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
}

/** Calendar year in Asia/Baku (for INV-YYYY, cash yearStart, vacation year). */
export function bakuCalendarYear(at = new Date()): number {
  return bakuYmd(at).y;
}

/** Civil YYYY-MM-DD of 1 January in the Baku calendar year of `at`. */
export function bakuYearStartYmd(at = new Date()): string {
  return `${bakuCalendarYear(at)}-01-01`;
}

/** End of calendar day in Asia/Baku for a Y-M-D triplet → UTC instant. */
export function bakuEndOfDayUtc(y: number, m: number, day: number): Date {
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59.999`;
  return bakuInstantFromLocalIso(iso);
}

/**
 * Platform trial end: last moment of calendar month `(registration month + months)` in Baku.
 * Example: 2026-06-10 → 2026-09-30 23:59:59.999 Baku.
 */
export function computeTrialExpiresEndOfMonthBaku(
  registrationAt: Date,
  months = 3,
): Date {
  const { y, m } = bakuYmd(registrationAt);
  const totalMonths = m - 1 + Math.max(1, Math.floor(months));
  const endY = y + Math.floor(totalMonths / 12);
  const endM = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  return bakuEndOfDayUtc(endY, endM, lastDay);
}

/**
 * @deprecated Prefer {@link computeTrialExpiresEndOfMonthBaku} for org registration trials.
 * End of calendar day in Asia/Baku after adding `months` whole calendar months to signup (Baku date).
 */
export function computeTrialExpiresAtBaku(signupAt: Date, months = 3): Date {
  const { y, m, day } = bakuYmd(signupAt);
  const totalMonths = m - 1 + Math.max(1, Math.floor(months));
  const endY = y + Math.floor(totalMonths / 12);
  const endM = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  const endDay = Math.min(day, lastDay);
  return bakuEndOfDayUtc(endY, endM, endDay);
}

function bakuInstantFromLocalIso(localIso: string): Date {
  const utcGuess = new Date(`${localIso}Z`);
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utcGuess);
  const tzName = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "+04";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetMin = 4 * 60;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const h = Number(match[2]);
    const min = Number(match[3] ?? 0);
    offsetMin = sign * (h * 60 + min);
  }
  return new Date(utcGuess.getTime() - offsetMin * 60 * 1000);
}
