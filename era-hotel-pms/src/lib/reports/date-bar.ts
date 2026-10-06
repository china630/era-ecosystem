import { addBakuDays, bakuCivilUtcDate } from '@era/satellite-kit/time';
import type { ReportDateMode } from './catalog';
import { resolveDateMode, resolvePreset, type PeriodPreset } from './period';
import { hotelDateKey } from '@/lib/hotel-calendar';

/** Radio presets on the reports date bar, in display order. */
export const DATE_BAR_PRESETS: PeriodPreset[] = [
  'default',
  'today',
  'yesterday',
  'tomorrow',
  'thisWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
];

export interface DateBarPeriod {
  from: string;
  to: string;
}

/** Last closed audit day: the open business day minus one unless the day is already closed. */
export function closedBusinessDay(currentBusinessDate: string, status: string | null | undefined): string {
  return status === 'CLOSED' ? currentBusinessDate : addBakuDays(currentBusinessDate, -1);
}

/** Month / year reports open on 1st or Jan 1 through the closed day with no radio selected. */
export function opensWithoutPreset(mode: ReportDateMode): boolean {
  return mode === 'month_to_closed' || mode === 'year_to_closed';
}

export function defaultPeriod(mode: ReportDateMode, businessDay: string, closedDay: string): DateBarPeriod {
  if (opensWithoutPreset(mode)) {
    const r = resolveDateMode(mode, bakuCivilUtcDate(closedDay));
    return { from: hotelDateKey(r.from), to: hotelDateKey(r.to) };
  }
  return { from: businessDay, to: businessDay };
}

/** Both fields from a radio; `default` follows the report date mode. */
export function presetPeriod(
  preset: PeriodPreset,
  mode: ReportDateMode,
  businessDay: string,
  closedDay: string,
): DateBarPeriod {
  if (preset === 'default') return defaultPeriod(mode, businessDay, closedDay);
  const r = resolvePreset(preset, bakuCivilUtcDate(businessDay));
  return { from: hotelDateKey(r.from), to: hotelDateKey(r.to) };
}

/** Manual edits keep from ≤ to by moving the other field. */
export function editPeriod(current: DateBarPeriod, field: 'from' | 'to', value: string): DateBarPeriod {
  if (field === 'from') return { from: value, to: current.to < value ? value : current.to };
  return { from: current.from > value ? value : current.from, to: value };
}
