import type { ReportDateMode } from './catalog';

export type PeriodPreset =
  | 'default'
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function resolvePreset(
  preset: PeriodPreset,
  referenceDate: Date = new Date(),
): { from: Date; to: Date } {
  const ref = startOfDay(referenceDate);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  switch (preset) {
    case 'today':
    case 'default':
      return { from: ref, to: ref };
    case 'yesterday':
      return { from: new Date(y, m, d - 1), to: new Date(y, m, d - 1) };
    case 'tomorrow':
      return { from: new Date(y, m, d + 1), to: new Date(y, m, d + 1) };
    case 'thisWeek': {
      const dow = ref.getDay();
      const mon = new Date(y, m, d - ((dow + 6) % 7));
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      return { from: mon, to: sun };
    }
    case 'thisMonth':
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    case 'lastMonth':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
    case 'thisYear':
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
    case 'lastYear':
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
  }
}

export function resolveDateMode(
  mode: ReportDateMode,
  businessDate: Date,
): { from: Date; to: Date } {
  const bd = startOfDay(businessDate);
  switch (mode) {
    case 'business_date':
      return { from: bd, to: bd };
    case 'month_to_closed':
      return { from: new Date(bd.getFullYear(), bd.getMonth(), 1), to: bd };
    case 'year_to_closed':
      return { from: new Date(bd.getFullYear(), 0, 1), to: bd };
    case 'range':
      return { from: bd, to: bd };
  }
}
