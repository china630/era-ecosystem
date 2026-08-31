import { parseDateCell } from '@/lib/import/helpers';

describe('parseDateCell', () => {
  it('converts Elektraweb Excel serials to UTC calendar dates', () => {
    const d = parseDateCell('36892.00028');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString().slice(0, 10)).toBe('2001-01-01');
    expect(parseDateCell(45469)?.toISOString().slice(0, 10)).toBe('2024-06-26');
  });

  it('keeps the Excel serial time-of-day fraction', () => {
    const d = parseDateCell(46264.41694444444);
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString().slice(0, 10)).toBe('2026-08-30');
    expect(d?.getUTCHours()).not.toBe(0);
    expect(parseDateCell(36892.00028, { dateOnly: true })?.toISOString().slice(0, 10)).toBe(
      '2001-01-01',
    );
  });

  it('drops EW empty markers', () => {
    expect(parseDateCell('NAN')).toBeNull();
    expect(parseDateCell('0')).toBeNull();
    expect(parseDateCell(null)).toBeNull();
  });
});
