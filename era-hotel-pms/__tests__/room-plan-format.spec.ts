import {
  childrenTotal,
  formatPax,
  formatPlanDate,
  hoverMarkerLabel,
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

  it('builds hover marker room · date', () => {
    expect(hoverMarkerLabel('707', '2026-08-31')).toBe('707 · 31.08.2026');
  });
});
