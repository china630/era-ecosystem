import {
  childrenTotal,
  formatPax,
  formatPlanBarNames,
  formatPlanDate,
  formatPlanDebtBadge,
  hoverMarkerLabel,
  planHeaderParts,
} from '@/components/room-plan/format';

describe('room-plan format helpers', () => {
  it('formats stay dates as DD.MM.YYYY', () => {
    expect(formatPlanDate('2026-08-31T10:00:00.000Z')).toBe('31.08.2026');
    expect(formatPlanDate('2026-08-22')).toBe('22.08.2026');
  });

  it('formats pax as adults+children', () => {
    expect(formatPax(1, 0, 0, 0)).toBe('1+0');
    expect(formatPax(2, 1, 0, 0)).toBe('2+1');
    expect(childrenTotal(1, 1, 1)).toBe(3);
  });

  it('joins party and roommate names without duplicates', () => {
    expect(formatPlanBarNames('Anita Molotkova', ['Petr Molotkov'])).toBe(
      'Anita Molotkova / Petr Molotkov',
    );
    expect(formatPlanBarNames('A A', ['A A', 'B B'])).toBe('A A / B B');
  });

  it('shows guest folio debt on the nose when balance is due', () => {
    expect(formatPlanDebtBadge(130)).toBe('130');
    expect(formatPlanDebtBadge(0)).toBeNull();
    expect(formatPlanDebtBadge(-5)).toBeNull();
  });

  it('splits date header into day number and weekday', () => {
    const parts = planHeaderParts('2026-09-06', 'en');
    expect(parts.day).toBe('6');
    expect(parts.weekday.toLowerCase()).toMatch(/^sun/);
  });

  it('builds hover marker room · date', () => {
    expect(hoverMarkerLabel('707', '2026-08-31')).toBe('707 · 31.08.2026');
  });
});
