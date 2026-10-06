import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import {
  closedBusinessDay,
  defaultPeriod,
  editPeriod,
  opensWithoutPreset,
  presetPeriod,
} from '@/lib/reports/date-bar';
import { resolveDateMode } from '@/lib/reports/period';
import { safeDiv, safePct } from '@/lib/reports/ratio';

describe('reports date bar', () => {
  const businessDay = '2026-10-05';
  const closedDay = closedBusinessDay(businessDay, 'OPEN');

  it('uses the previous day as the closed day while the business day is open', () => {
    expect(closedDay).toBe('2026-10-04');
    expect(closedBusinessDay(businessDay, 'CLOSED')).toBe(businessDay);
  });

  it('fills both fields from This Month', () => {
    expect(presetPeriod('thisMonth', 'business_date', businessDay, closedDay)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('opens month and year reports on the closed day with no radio', () => {
    expect(opensWithoutPreset('month_to_closed')).toBe(true);
    expect(opensWithoutPreset('business_date')).toBe(false);
    expect(defaultPeriod('month_to_closed', businessDay, closedDay)).toEqual({ from: '2026-10-01', to: '2026-10-04' });
    expect(defaultPeriod('year_to_closed', businessDay, closedDay)).toEqual({ from: '2026-01-01', to: '2026-10-04' });
    expect(defaultPeriod('business_date', businessDay, closedDay)).toEqual({ from: businessDay, to: businessDay });
  });

  it('keeps Start before End on manual edits', () => {
    const month = { from: '2026-10-01', to: '2026-10-31' };
    expect(editPeriod(month, 'to', '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(editPeriod(month, 'to', '2026-09-20')).toEqual({ from: '2026-09-20', to: '2026-09-20' });
    expect(editPeriod(month, 'from', '2026-11-02')).toEqual({ from: '2026-11-02', to: '2026-11-02' });
  });

  it('ends the nightly pack year report on the closed day', () => {
    const r = resolveDateMode('year_to_closed', bakuCivilUtcDate('2026-10-04'));
    expect(hotelDateKey(r.from)).toBe('2026-01-01');
    expect(hotelDateKey(r.to)).toBe('2026-10-04');
  });
});

describe('report ratios', () => {
  it('returns null when the denominator is zero or missing', () => {
    expect(safePct(5, 0)).toBeNull();
    expect(safePct(5, null)).toBeNull();
    expect(safeDiv(5, undefined)).toBeNull();
    expect(safePct(1, 3)).toBe(33.3);
    expect(safeDiv(10, 4)).toBe(2.5);
  });
});
