export type HotelStatusLevel = 'NORMAL' | 'RISK' | 'CRITICAL';

export type MetricTriple = {
  today: number;
  yesterday: number;
  lastWeek: number;
};

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function startOfYear(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), 0, 1));
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

/** Map revenue code → Daily Flash bucket. */
export function revenueFlashBucket(code: string, departmentCode?: string | null): 'room' | 'fb' | 'spa' | 'medical' | 'other' {
  const c = code.toUpperCase();
  const dept = (departmentCode ?? '').toUpperCase();
  // TOUR is ACC-department but excursion P&L — do not inherit the ACC→room catch-all.
  if (c === 'TOUR') return 'other';
  if (c === 'ROOM' || c === 'PKG' || c === 'TRANSFER' || dept === 'ACC') return 'room';
  if (c === 'FOOD' || c === 'BOARD' || c === 'MINIBAR' || dept === 'REST') return 'fb';
  if (c === 'TREATMENT' || c.includes('SPA')) return 'spa';
  if (c === 'MEDICAL' || c === 'MED' || dept === 'MED') return 'medical';
  return 'other';
}
