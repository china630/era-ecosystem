/**
 * Wave 10: classify presence / break intervals into timesheet minute buckets
 * (Asia/Baku wall clock). Pure — no I/O.
 */

import { utcFromYmd } from "./roster-cycle.util";

export type TimeInterval = { start: Date; end: Date };

export type MinuteBuckets = {
  normalMinutes: number;
  shortfallMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  restDayMinutes: number;
  holidayMinutes: number;
  hourlyLeaveMinutes: number;
  breakMinutes: number;
  /** hours = normalMinutes / 60, 2 dp — planned window only. */
  hours: number;
};

export type CalendarDayKind = "working" | "holiday" | "rest";

const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;
const MS_MIN = 60 * 1000;

/** Baku is UTC+4 year-round. */
export function bakuWallToUtc(ymd: string, minuteOfDay: number): Date {
  const clamped = Math.max(0, Math.min(24 * 60, minuteOfDay));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return new Date(
    `${ymd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+04:00`,
  );
}

export function addBakuDays(ymd: string, days: number): string {
  const d = utcFromYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function intervalMinutes(iv: TimeInterval): number {
  const ms = iv.end.getTime() - iv.start.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / MS_MIN);
}

export function mergeIntervals(list: TimeInterval[]): TimeInterval[] {
  const sorted = [...list]
    .filter((iv) => iv.end.getTime() > iv.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!sorted.length) return [];
  const out: TimeInterval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Subtract subtrahends from base intervals. */
export function subtractIntervals(
  base: TimeInterval[],
  subtrahends: TimeInterval[],
): TimeInterval[] {
  let cur = mergeIntervals(base);
  for (const sub of mergeIntervals(subtrahends)) {
    const next: TimeInterval[] = [];
    for (const iv of cur) {
      if (sub.end.getTime() <= iv.start.getTime() || sub.start.getTime() >= iv.end.getTime()) {
        next.push(iv);
        continue;
      }
      if (sub.start.getTime() > iv.start.getTime()) {
        next.push({ start: iv.start, end: new Date(Math.min(sub.start.getTime(), iv.end.getTime())) });
      }
      if (sub.end.getTime() < iv.end.getTime()) {
        next.push({ start: new Date(Math.max(sub.end.getTime(), iv.start.getTime())), end: iv.end });
      }
    }
    cur = next.filter((x) => x.end.getTime() > x.start.getTime());
  }
  return cur;
}

export function intersectIntervals(
  a: TimeInterval[],
  b: TimeInterval[],
): TimeInterval[] {
  const out: TimeInterval[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start.getTime(), y.start.getTime());
      const end = Math.min(x.end.getTime(), y.end.getTime());
      if (end > start) out.push({ start: new Date(start), end: new Date(end) });
    }
  }
  return mergeIntervals(out);
}

/** Planned shift window as absolute interval(s) for workYmd (IN date). */
export function plannedWindowIntervals(
  workYmd: string,
  startMinute: number,
  endMinute: number,
): TimeInterval[] {
  if (startMinute === endMinute) return [];
  if (startMinute < endMinute) {
    return [
      {
        start: bakuWallToUtc(workYmd, startMinute),
        end: bakuWallToUtc(workYmd, endMinute),
      },
    ];
  }
  return [
    {
      start: bakuWallToUtc(workYmd, startMinute),
      end: bakuWallToUtc(addBakuDays(workYmd, 1), endMinute),
    },
  ];
}

/** Night band 22:00–06:00 for workYmd and the following Baku day. */
export function nightBandIntervals(workYmd: string): TimeInterval[] {
  const next = addBakuDays(workYmd, 1);
  return [
    {
      start: bakuWallToUtc(workYmd, NIGHT_START),
      end: bakuWallToUtc(next, NIGHT_END),
    },
    {
      start: bakuWallToUtc(next, NIGHT_START),
      end: bakuWallToUtc(addBakuDays(next, 1), NIGHT_END),
    },
  ];
}

export function plannedPresenceMinutes(
  startMinute: number,
  endMinute: number,
  breakMinutes: number,
): number {
  if (startMinute === endMinute) return 0;
  const raw =
    startMinute < endMinute
      ? endMinute - startMinute
      : 24 * 60 - startMinute + endMinute;
  return Math.max(0, raw - Math.max(0, breakMinutes));
}

export function classifyMinuteBuckets(input: {
  presence: TimeInterval[];
  breaks: TimeInterval[];
  workYmd: string;
  startMinute: number | null;
  endMinute: number | null;
  plannedBreakMinutes: number;
  calendarKind: CalendarDayKind;
  wasShiftDay: boolean;
}): MinuteBuckets {
  const breakMerged = mergeIntervals(input.breaks);
  const breakMinutes = breakMerged.reduce((s, iv) => s + intervalMinutes(iv), 0);
  const net = subtractIntervals(input.presence, breakMerged);
  const totalNet = net.reduce((s, iv) => s + intervalMinutes(iv), 0);

  const night = intersectIntervals(net, nightBandIntervals(input.workYmd));
  const nightMinutes = night.reduce((s, iv) => s + intervalMinutes(iv), 0);

  const empty: MinuteBuckets = {
    normalMinutes: 0,
    shortfallMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes,
    restDayMinutes: 0,
    holidayMinutes: 0,
    hourlyLeaveMinutes: 0,
    breakMinutes,
    hours: 0,
  };

  if (input.calendarKind === "holiday") {
    return {
      ...empty,
      holidayMinutes: totalNet,
      hours: 0,
    };
  }
  if (input.calendarKind === "rest") {
    return {
      ...empty,
      restDayMinutes: totalNet,
      hours: 0,
    };
  }

  const hasWindow =
    input.startMinute != null &&
    input.endMinute != null &&
    input.startMinute !== input.endMinute;
  if (!hasWindow) {
    return {
      ...empty,
      overtimeMinutes: totalNet,
      hours: 0,
    };
  }

  const window = plannedWindowIntervals(
    input.workYmd,
    input.startMinute!,
    input.endMinute!,
  );
  const inside = intersectIntervals(net, window);
  const outside = subtractIntervals(net, window);
  const normalMinutes = inside.reduce((s, iv) => s + intervalMinutes(iv), 0);
  const overtimeMinutes = outside.reduce((s, iv) => s + intervalMinutes(iv), 0);
  const planned = plannedPresenceMinutes(
    input.startMinute!,
    input.endMinute!,
    input.plannedBreakMinutes,
  );
  const shortfallMinutes =
    input.wasShiftDay && planned > 0
      ? Math.max(0, planned - normalMinutes)
      : 0;
  const hours = Math.round((normalMinutes / 60) * 100) / 100;

  return {
    normalMinutes,
    shortfallMinutes,
    overtimeMinutes,
    nightMinutes,
    restDayMinutes: 0,
    holidayMinutes: 0,
    hourlyLeaveMinutes: 0,
    breakMinutes,
    hours,
  };
}

export function calendarKindFromDay(day: {
  dayType?: string | null;
  isWorking?: boolean | null;
} | null): CalendarDayKind {
  if (!day) return "working";
  const t = (day.dayType ?? "").toLowerCase();
  if (t === "holiday") return "holiday";
  if (
    t === "weekend" ||
    t === "rest" ||
    t === "transferred_rest" ||
    day.isWorking === false
  ) {
    return "rest";
  }
  return "working";
}
