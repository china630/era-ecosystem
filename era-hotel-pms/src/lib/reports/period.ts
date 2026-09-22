import type { ReportDateMode } from './catalog';
import { bakuCivilUtcDate, bakuYmd } from '@era/satellite-kit/time';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';

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

function civil(ymd: string): Date {
  return bakuCivilUtcDate(ymd);
}

function lastYmdOfMonth(y: number, month1to12: number): string {
  const last = new Date(Date.UTC(y, month1to12, 0)).getUTCDate();
  return `${y}-${String(month1to12).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** Monday of the Asia/Baku week containing `ymd` (Mon–Sun). */
function mondayOf(ymd: string): string {
  const noon = new Date(`${ymd}T08:00:00.000Z`);
  const dow = noon.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addHotelDays(ymd, diff);
}

export function resolvePreset(
  preset: PeriodPreset,
  referenceDate: Date = new Date(),
): { from: Date; to: Date } {
  const ymd = hotelDateKey(referenceDate);
  const { y, m } = bakuYmd(civil(ymd));

  switch (preset) {
    case 'today':
    case 'default':
      return { from: civil(ymd), to: civil(ymd) };
    case 'yesterday': {
      const d = addHotelDays(ymd, -1);
      return { from: civil(d), to: civil(d) };
    }
    case 'tomorrow': {
      const d = addHotelDays(ymd, 1);
      return { from: civil(d), to: civil(d) };
    }
    case 'thisWeek': {
      const mon = mondayOf(ymd);
      return { from: civil(mon), to: civil(addHotelDays(mon, 6)) };
    }
    case 'thisMonth':
      return {
        from: civil(`${y}-${String(m).padStart(2, '0')}-01`),
        to: civil(lastYmdOfMonth(y, m)),
      };
    case 'lastMonth': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return {
        from: civil(`${py}-${String(pm).padStart(2, '0')}-01`),
        to: civil(lastYmdOfMonth(py, pm)),
      };
    }
    case 'thisYear':
      return { from: civil(`${y}-01-01`), to: civil(`${y}-12-31`) };
    case 'lastYear':
      return { from: civil(`${y - 1}-01-01`), to: civil(`${y - 1}-12-31`) };
  }
}

export function resolveDateMode(
  mode: ReportDateMode,
  businessDate: Date,
): { from: Date; to: Date } {
  const ymd = hotelDateKey(businessDate);
  const { y, m } = bakuYmd(civil(ymd));
  const bd = civil(ymd);
  switch (mode) {
    case 'business_date':
      return { from: bd, to: bd };
    case 'month_to_closed':
      return { from: civil(`${y}-${String(m).padStart(2, '0')}-01`), to: bd };
    case 'year_to_closed':
      return { from: civil(`${y}-01-01`), to: bd };
    case 'range':
      return { from: bd, to: bd };
  }
}
