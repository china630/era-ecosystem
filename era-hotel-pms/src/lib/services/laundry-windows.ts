/** Asia/Baku wall clock. AZT is UTC+4 year-round (no DST). */

export const BAKU_OFFSET_HOURS = 4;

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

export function nextBakuWorkingDay(y: number, m: number, d: number): { y: number; m: number; d: number } {
  let cur = addBakuCalendarDays(y, m, d, 1);
  while (bakuWeekdayIndex(cur.y, cur.m, cur.d) === 0) {
    cur = addBakuCalendarDays(cur.y, cur.m, cur.d, 1);
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
}): string | null {
  const { weekday, hour } = bakuParts(input.now);
  if (weekday === 'Sun') return 'No laundry intake on Sunday';
  if (input.dayType === 'holiday' || input.dayType === 'transferred_rest') {
    return 'No laundry intake on labour holiday';
  }
  if (input.express && !input.expressEnabled) {
    return 'Express laundry is disabled for this hotel';
  }
  if (input.hasWash && (hour < 9 || hour >= 17)) {
    return 'Wash intake is 09:00–17:00 Asia/Baku';
  }
  if (input.hasIron && !input.hasWash && (hour < 9 || hour >= 20)) {
    return 'Iron intake is 09:00–20:00 Asia/Baku';
  }
  if (input.hasIron && input.hasWash && (hour < 9 || hour >= 17)) {
    return 'Mixed wash+iron intake follows wash window 09:00–17:00 Asia/Baku';
  }
  if (!input.hasWash && !input.hasIron) return 'No laundry lines';
  return null;
}

/** Same-day 17:00 Baku if accepted before 10:00; else next working day 17:00 Baku. */
export function laundryDueAt(now: Date): Date {
  const p = bakuParts(now);
  const dueDay = p.hour < 10 ? { y: p.y, m: p.m, d: p.d } : nextBakuWorkingDay(p.y, p.m, p.d);
  return bakuWallToUtc(dueDay.y, dueDay.m, dueDay.d, 17, 0);
}

export function bakuHhmm(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baku',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** Store needed-by as 17:00-style wall time in Baku on the business date. */
export function neededByBakuToUtc(workDateIso: string, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const [y, m, d] = workDateIso.split('-').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !y || !m || !d) throw new Error('Invalid time');
  return bakuWallToUtc(y, m, d, hh, mm);
}

export const bakuClockHhmm = bakuHhmm;
