import { prisma } from "@/lib/prisma";
import type {
  PractitionerScheduleRule,
  PractitionerScheduleException,
} from "@prisma/client";

/**
 * CLI-36 — doctor shift rotation resolution.
 *
 * Rules stack (union of intervals). A practitioner with NO active rules and no
 * exceptions on a day resolves to `null` = unrestricted (tenant working hours),
 * which preserves the pre-CLI-36 behaviour where every doctor is available all
 * open days.
 *
 * All date math treats the Asia/Baku calendar date as a pure date and derives
 * weekday / day-of-month / ISO-week via UTC to avoid timezone drift.
 */

export type TimeInterval = { startMinute: number; endMinute: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function bakuYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ymdParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return { y, m, d };
}

function utcFromYmd(ymd: string): Date {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 0 = Sunday .. 6 = Saturday (Baku calendar date). */
export function weekdayOfYmd(ymd: string): number {
  return utcFromYmd(ymd).getUTCDay();
}

function dayOfMonthOfYmd(ymd: string): number {
  return ymdParts(ymd).d;
}

/** ISO-8601 week number (Mon-based, week 1 contains the first Thursday). */
function isoWeekOfYmd(ymd: string): number {
  const date = utcFromYmd(ymd);
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}

function parityMatches(n: number, parity: "EVEN" | "ODD" | null): boolean {
  if (!parity) return true;
  const even = n % 2 === 0;
  return parity === "EVEN" ? even : !even;
}

function parseIntArray(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
  } catch {
    return [];
  }
}

function withinEffective(rule: PractitionerScheduleRule, ymd: string): boolean {
  if (rule.effectiveFrom && ymd < bakuYmd(rule.effectiveFrom)) return false;
  if (rule.effectiveTo && ymd > bakuYmd(rule.effectiveTo)) return false;
  return true;
}

function ruleMatchesDate(rule: PractitionerScheduleRule, ymd: string): boolean {
  if (!rule.active) return false;
  if (!withinEffective(rule, ymd)) return false;

  switch (rule.pattern) {
    case "WEEKLY": {
      const weekdays = parseIntArray(rule.weekdaysJson);
      return weekdays.includes(weekdayOfYmd(ymd));
    }
    case "WEEK_PARITY": {
      const weekdays = parseIntArray(rule.weekdaysJson);
      if (!weekdays.includes(weekdayOfYmd(ymd))) return false;
      return parityMatches(isoWeekOfYmd(ymd), rule.parity);
    }
    case "MONTH_DAY_PARITY": {
      const weekdays = parseIntArray(rule.weekdaysJson);
      if (weekdays.length > 0 && !weekdays.includes(weekdayOfYmd(ymd))) return false;
      return parityMatches(dayOfMonthOfYmd(ymd), rule.parity);
    }
    case "CYCLE": {
      if (!rule.cycleAnchor || !rule.cycleLengthDays || rule.cycleLengthDays < 1) return false;
      const anchorUtc = utcFromYmd(bakuYmd(rule.cycleAnchor)).getTime();
      const targetUtc = utcFromYmd(ymd).getTime();
      const diffDays = Math.round((targetUtc - anchorUtc) / MS_PER_DAY);
      const offset = ((diffDays % rule.cycleLengthDays) + rule.cycleLengthDays) % rule.cycleLengthDays;
      return parseIntArray(rule.cycleOffsetsJson).includes(offset);
    }
    default:
      return false;
  }
}

/** Merge overlapping/adjacent intervals into a sorted, disjoint list. */
export function mergeIntervals(list: TimeInterval[]): TimeInterval[] {
  const clean = list
    .filter((i) => Number.isFinite(i.startMinute) && Number.isFinite(i.endMinute) && i.endMinute > i.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);
  const out: TimeInterval[] = [];
  for (const iv of clean) {
    const last = out[out.length - 1];
    if (last && iv.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, iv.endMinute);
    } else {
      out.push({ ...iv });
    }
  }
  return out;
}

function applyExceptions(
  base: TimeInterval[],
  exceptions: PractitionerScheduleException[],
): TimeInterval[] {
  const dayOff = exceptions.find((e) => e.kind === "DAY_OFF");
  if (dayOff) return [];

  const custom = exceptions.find((e) => e.kind === "CUSTOM_HOURS");
  let intervals = custom
    ? [{ startMinute: custom.startMinute ?? 0, endMinute: custom.endMinute ?? 0 }]
    : [...base];

  for (const extra of exceptions.filter((e) => e.kind === "EXTRA_SHIFT")) {
    intervals.push({ startMinute: extra.startMinute ?? 0, endMinute: extra.endMinute ?? 0 });
  }
  return mergeIntervals(intervals);
}

function resolveFromData(
  rules: PractitionerScheduleRule[],
  exceptions: PractitionerScheduleException[],
  ymd: string,
): TimeInterval[] | null {
  const hasRules = rules.length > 0;
  const dayExceptions = exceptions.filter((e) => bakuYmd(e.date) === ymd);
  if (!hasRules && dayExceptions.length === 0) return null; // unrestricted

  const base = mergeIntervals(
    rules
      .filter((r) => ruleMatchesDate(r, ymd))
      .map((r) => ({ startMinute: r.startMinute, endMinute: r.endMinute })),
  );
  return applyExceptions(base, dayExceptions);
}

/**
 * Resolve a single practitioner's bookable intervals for a Baku calendar day.
 * Returns `null` when the practitioner has no schedule configured (unrestricted).
 */
export async function resolvePractitionerDayIntervals(
  practitionerId: string,
  ymd: string,
): Promise<TimeInterval[] | null> {
  const [rules, exceptions] = await Promise.all([
    prisma.practitionerScheduleRule.findMany({
      where: { practitionerId, active: true },
    }),
    prisma.practitionerScheduleException.findMany({
      where: { practitionerId },
    }),
  ]);
  return resolveFromData(rules, exceptions, ymd);
}

/** Batch variant for the day matrix. */
export async function resolveManyDayIntervals(
  practitionerIds: string[],
  ymd: string,
): Promise<Map<string, TimeInterval[] | null>> {
  const result = new Map<string, TimeInterval[] | null>();
  if (practitionerIds.length === 0) return result;

  const [rules, exceptions] = await Promise.all([
    prisma.practitionerScheduleRule.findMany({
      where: { practitionerId: { in: practitionerIds }, active: true },
    }),
    prisma.practitionerScheduleException.findMany({
      where: { practitionerId: { in: practitionerIds } },
    }),
  ]);

  const rulesBy = new Map<string, PractitionerScheduleRule[]>();
  for (const r of rules) {
    const list = rulesBy.get(r.practitionerId) ?? [];
    list.push(r);
    rulesBy.set(r.practitionerId, list);
  }
  const excBy = new Map<string, PractitionerScheduleException[]>();
  for (const e of exceptions) {
    const list = excBy.get(e.practitionerId) ?? [];
    list.push(e);
    excBy.set(e.practitionerId, list);
  }

  for (const id of practitionerIds) {
    result.set(id, resolveFromData(rulesBy.get(id) ?? [], excBy.get(id) ?? [], ymd));
  }
  return result;
}

/** True if [startMinute, endMinute) is fully covered by one interval. */
export function intervalsCover(
  intervals: TimeInterval[] | null,
  startMinute: number,
  endMinute: number,
): boolean {
  if (intervals === null) return true; // unrestricted
  return intervals.some((iv) => startMinute >= iv.startMinute && endMinute <= iv.endMinute);
}

function bakuMinuteOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/**
 * Booking guard: does `scheduledAt` (+slotMinutes) fall inside the practitioner
 * shift for that Baku day? Unrestricted practitioners always pass.
 */
export async function isWithinShift(
  practitionerId: string,
  scheduledAt: Date,
  slotMinutes: number,
): Promise<boolean> {
  const ymd = bakuYmd(scheduledAt);
  const intervals = await resolvePractitionerDayIntervals(practitionerId, ymd);
  if (intervals === null) return true;
  if (intervals.length === 0) return false;
  const startMin = bakuMinuteOfDay(scheduledAt);
  return intervalsCover(intervals, startMin, startMin + Math.max(1, slotMinutes));
}
