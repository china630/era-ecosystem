/** Asia/Baku wall clock. AZT is UTC+4 year-round (no DST). */

export const BAKU_OFFSET_HOURS = 4;

export type LaundryClosedDays =
  | 'ALL'
  | 'EXCEPT_SUNDAY'
  | 'EXCEPT_CALENDAR'
  | 'EXCEPT_SUNDAY_AND_CALENDAR';

export type LaundryIntakePolicy = {
  intakeMode: 'ANY' | 'WINDOW';
  intakeStartHour: number | null;
  intakeEndHour: number | null;
  closedDays: LaundryClosedDays;
  dueMode: 'NONE' | 'BY_HOUR';
  dueCutoffHour: number;
  dueAtHour: number;
  expressEnabled?: boolean;
};

/** Matches prior hardcoded Nafta windows (wash 09–17) until the hotel edits policy. */
export const DEFAULT_LAUNDRY_INTAKE_POLICY: LaundryIntakePolicy = {
  intakeMode: 'WINDOW',
  intakeStartHour: 9,
  intakeEndHour: 17,
  closedDays: 'EXCEPT_SUNDAY_AND_CALENDAR',
  dueMode: 'BY_HOUR',
  dueCutoffHour: 10,
  dueAtHour: 17,
  expressEnabled: false,
};

export type LaundryLineKind = { washQty: number; ironQty: number };

export function bakuParts(now: Date): { y: number; m: number; d: number; hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baku',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hour: Number(get('hour')),
    weekday: get('weekday'),
  };
}

export function bakuWallToUtc(y: number, m: number, d: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hour - BAKU_OFFSET_HOURS, minute, 0, 0));
}

export function addBakuCalendarDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function bakuWeekdayIndex(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isLaundryCalendarClosed(dayType?: string | null): boolean {
  return dayType === 'holiday' || dayType === 'transferred_rest';
}

export function isLaundryDayClosed(input: {
  weekday: string;
  closedDays: LaundryClosedDays;
  dayType?: string | null;
}): boolean {
  const sunday = input.weekday === 'Sun';
  const calendar = isLaundryCalendarClosed(input.dayType);
  switch (input.closedDays) {
    case 'ALL':
      return false;
    case 'EXCEPT_SUNDAY':
      return sunday;
    case 'EXCEPT_CALENDAR':
      return calendar;
    case 'EXCEPT_SUNDAY_AND_CALENDAR':
    default:
      return sunday || calendar;
  }
}

export function nextBakuWorkingDay(
  y: number,
  m: number,
  d: number,
  closedDays: LaundryClosedDays = 'EXCEPT_SUNDAY_AND_CALENDAR',
): { y: number; m: number; d: number } {
  let cur = addBakuCalendarDays(y, m, d, 1);
  for (let i = 0; i < 14; i += 1) {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][bakuWeekdayIndex(cur.y, cur.m, cur.d)]!;
    // Calendar holidays are unknown when scanning ahead without a calendar map —
    // skip Sunday when the mode includes Sunday; calendar-only modes advance one day.
    const sundayBlocked =
      closedDays === 'EXCEPT_SUNDAY' || closedDays === 'EXCEPT_SUNDAY_AND_CALENDAR';
    if (sundayBlocked && weekday === 'Sun') {
      cur = addBakuCalendarDays(cur.y, cur.m, cur.d, 1);
      continue;
    }
    return cur;
  }
  return cur;
}

export function laundryIntakeBlockReason(input: {
  now: Date;
  hasWash: boolean;
  hasIron: boolean;
  express: boolean;
  expressEnabled?: boolean;
  dayType?: string | null;
  policy?: Partial<LaundryIntakePolicy> | null;
}): string | null {
  const policy: LaundryIntakePolicy = {
    ...DEFAULT_LAUNDRY_INTAKE_POLICY,
    ...(input.policy ?? {}),
    expressEnabled: input.expressEnabled ?? input.policy?.expressEnabled,
  };
  const { weekday, hour } = bakuParts(input.now);
  if (isLaundryDayClosed({ weekday, closedDays: policy.closedDays, dayType: input.dayType })) {
    if (weekday === 'Sun' && (policy.closedDays === 'EXCEPT_SUNDAY' || policy.closedDays === 'EXCEPT_SUNDAY_AND_CALENDAR')) {
      return 'No laundry intake on Sunday';
    }
    if (isLaundryCalendarClosed(input.dayType)) {
      return 'No laundry intake on labour holiday';
    }
    return 'No laundry intake on this day';
  }
  if (input.express && !policy.expressEnabled) {
    return 'Express laundry is disabled for this hotel';
  }
  if (policy.intakeMode === 'WINDOW') {
    const start = policy.intakeStartHour ?? 0;
    const end = policy.intakeEndHour ?? 24;
    if (hour < start || hour >= end) {
      const a = String(start).padStart(2, '0');
      const b = String(end).padStart(2, '0');
      return `Laundry intake is ${a}:00–${b}:00 Asia/Baku`;
    }
  }
  if (!input.hasWash && !input.hasIron) return 'No laundry lines';
  return null;
}

/** Same-day due hour if accepted before cutoff; else next open day. null when dueMode is NONE. */
export function laundryDueAt(
  now: Date,
  policy?: Partial<LaundryIntakePolicy> | null,
): Date | null {
  const p: LaundryIntakePolicy = { ...DEFAULT_LAUNDRY_INTAKE_POLICY, ...(policy ?? {}) };
  if (p.dueMode === 'NONE') return null;
  const parts = bakuParts(now);
  const cutoff = p.dueCutoffHour ?? 10;
  const dueHour = p.dueAtHour ?? 17;
  const dueDay =
    parts.hour < cutoff
      ? { y: parts.y, m: parts.m, d: parts.d }
      : nextBakuWorkingDay(parts.y, parts.m, parts.d, p.closedDays);
  return bakuWallToUtc(dueDay.y, dueDay.m, dueDay.d, dueHour, 0);
}

export function bakuHhmm(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baku',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** Store needed-by as wall time in Baku on the business date. */
export function neededByBakuToUtc(workDateIso: string, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const [y, m, d] = workDateIso.split('-').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !y || !m || !d) throw new Error('Invalid time');
  return bakuWallToUtc(y, m, d, hh, mm);
}

export const bakuClockHhmm = bakuHhmm;

export function policyFromHkRow(row: {
  laundryIntakeMode?: string | null;
  laundryIntakeStartHour?: number | null;
  laundryIntakeEndHour?: number | null;
  laundryClosedDays?: string | null;
  laundryDueMode?: string | null;
  laundryDueCutoffHour?: number | null;
  laundryDueAtHour?: number | null;
  laundryExpressEnabled?: boolean | null;
}): LaundryIntakePolicy {
  const mode = row.laundryIntakeMode === 'WINDOW' ? 'WINDOW' : 'ANY';
  const closed =
    row.laundryClosedDays === 'ALL' ||
    row.laundryClosedDays === 'EXCEPT_SUNDAY' ||
    row.laundryClosedDays === 'EXCEPT_CALENDAR' ||
    row.laundryClosedDays === 'EXCEPT_SUNDAY_AND_CALENDAR'
      ? row.laundryClosedDays
      : DEFAULT_LAUNDRY_INTAKE_POLICY.closedDays;
  return {
    intakeMode: mode,
    intakeStartHour:
      row.laundryIntakeStartHour ??
      (mode === 'WINDOW' ? DEFAULT_LAUNDRY_INTAKE_POLICY.intakeStartHour : null),
    intakeEndHour:
      row.laundryIntakeEndHour ??
      (mode === 'WINDOW' ? DEFAULT_LAUNDRY_INTAKE_POLICY.intakeEndHour : null),
    closedDays: closed,
    dueMode: row.laundryDueMode === 'NONE' ? 'NONE' : 'BY_HOUR',
    dueCutoffHour: row.laundryDueCutoffHour ?? 10,
    dueAtHour: row.laundryDueAtHour ?? 17,
    expressEnabled: Boolean(row.laundryExpressEnabled),
  };
}
