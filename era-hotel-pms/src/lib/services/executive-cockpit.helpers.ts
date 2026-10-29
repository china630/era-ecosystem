import { bakuDayBounds, bakuYmd } from '@era/satellite-kit/time';
import { revenueRoleIn, revenueRoleIs } from '@/lib/revenue-code-match';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';

export type HotelStatusLevel = 'NORMAL' | 'RISK' | 'CRITICAL';

export type MetricTriple = {
  today: number;
  yesterday: number;
  lastWeek: number;
};

export function addDays(d: Date, n: number): Date {
  return bakuDayBounds(addHotelDays(hotelDateKey(d), n)).start;
}

export function startOfDay(d: Date): Date {
  return bakuDayBounds(hotelDateKey(d)).start;
}

export function endOfDay(d: Date): Date {
  const { end } = bakuDayBounds(hotelDateKey(d));
  return new Date(end.getTime() - 1);
}

export function startOfMonth(d: Date): Date {
  const { y, m } = bakuYmd(d);
  return bakuDayBounds(`${y}-${String(m).padStart(2, '0')}-01`).start;
}

export function startOfYear(d: Date): Date {
  const { y } = bakuYmd(d);
  return bakuDayBounds(`${y}-01-01`).start;
}

export function occupancyDeviationPct(fact: number, plan: number): number {
  return Math.round((fact - plan) * 10) / 10;
}

export function computeHotelStatus(input: {
  occupancyFactPct: number;
  occupancyDeviationPct: number;
  overdueBalance: number;
  totalReceivable: number;
}): HotelStatusLevel {
  const overdueRatio =
    input.totalReceivable > 0 ? input.overdueBalance / input.totalReceivable : 0;

  if (
    input.occupancyFactPct < 35 ||
    overdueRatio > 0.55 ||
    input.overdueBalance > 25_000
  ) {
    return 'CRITICAL';
  }
  if (
    input.occupancyFactPct < 55 ||
    overdueRatio > 0.3 ||
    input.overdueBalance > 8_000 ||
    input.occupancyDeviationPct < -15
  ) {
    return 'RISK';
  }
  return 'NORMAL';
}

/** Map revenue code → Daily Flash bucket: system role first, then the code's department. */
export function revenueFlashBucket(
  row: { systemRole: string | null },
  departmentCode?: string | null,
): 'room' | 'fb' | 'spa' | 'medical' | 'other' {
  const dept = (departmentCode ?? '').toUpperCase();
  // TOUR is ACC-department but excursion P&L; city tax is a liability, not revenue.
  if (revenueRoleIn(row, ['TOUR', 'CITY_TAX'])) return 'other';
  if (revenueRoleIn(row, ['ROOM', 'PKG', 'RATE_ADJ', 'EARLY_CI', 'LATE_CO', 'TRANSFER'])) {
    return 'room';
  }
  if (revenueRoleIn(row, ['FOOD', 'BOARD', 'MINIBAR', 'BANQUET'])) return 'fb';
  if (revenueRoleIs(row, 'TREATMENT')) return 'spa';
  if (revenueRoleIs(row, 'MEDICAL') || revenueRoleIs(row, 'PROCEDURE')) return 'medical';
  if (dept === 'ACC') return 'room';
  if (dept === 'REST') return 'fb';
  if (dept === 'SPA') return 'spa';
  if (dept === 'MED') return 'medical';
  return 'other';
}
