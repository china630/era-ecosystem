import { addBakuDays, bakuDateKey, bakuDayBounds } from '@era/satellite-kit/time';

/**
 * Report day math on Asia/Baku civil days. Charge `businessDate` and stay dates are stored as
 * instants (Baku midnight = 20:00Z the day before), so UTC-day equality misses them.
 */

export function civilDay(instant: Date): string {
  return bakuDateKey(instant);
}

/** Report query params arrive as `new Date('YYYY-MM-DD')` (UTC midnight); read the civil date back. */
export function ymdParam(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Half-open instant window covering civil days `fromYmd..toYmd` inclusive. */
export function civilWindow(fromYmd: string, toYmd: string): { gte: Date; lt: Date } {
  return { gte: bakuDayBounds(fromYmd).start, lt: bakuDayBounds(toYmd).end };
}

export function addCivilDays(ymd: string, days: number): string {
  return addBakuDays(ymd, days);
}

export function eachCivilDay(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  for (let d = fromYmd; d <= toYmd; d = addBakuDays(d, 1)) {
    out.push(d);
    if (out.length > 3700) break;
  }
  return out;
}

export function civilDayCount(fromYmd: string, toYmd: string): number {
  if (toYmd < fromYmd) return 0;
  return Math.round((bakuDayBounds(toYmd).start.getTime() - bakuDayBounds(fromYmd).start.getTime()) / 86_400_000) + 1;
}

/** Nights of a stay that fall on civil days `fromYmd..toYmd` (night = arrival day up to the day before departure). */
export function stayNightsIn(checkIn: Date, checkOut: Date, fromYmd: string, toYmd: string): number {
  const first = civilDay(checkIn);
  const lastExclusive = civilDay(checkOut);
  const start = first > fromYmd ? first : fromYmd;
  const endExclusive = lastExclusive <= toYmd ? lastExclusive : addBakuDays(toYmd, 1);
  if (endExclusive <= start) return 0;
  return civilDayCount(start, addBakuDays(endExclusive, -1));
}

export function stayCoversNight(checkIn: Date, checkOut: Date, ymd: string): boolean {
  return civilDay(checkIn) <= ymd && civilDay(checkOut) > ymd;
}

export function monthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function yearStartYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-01-01`;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** VAT rate from `RevenueCode.taxTag` ("18.00" → 0.18). Non-numeric tags mean no VAT. */
export function vatRateFromTag(tag: string | null | undefined): number {
  if (!tag) return 0;
  const n = Number(String(tag).replace(',', '.').replace('%', '').trim());
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return 0;
  return n / 100;
}

/** Charges are VAT-inclusive; split a gross amount into net and VAT. */
export function splitGross(gross: number, rate: number): { gross: number; net: number; vat: number } {
  const net = rate > 0 ? gross / (1 + rate) : gross;
  return { gross: round2(gross), net: round2(net), vat: round2(gross - net) };
}
