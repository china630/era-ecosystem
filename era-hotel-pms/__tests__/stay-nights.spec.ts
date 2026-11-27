import { countNights } from '@/lib/decimal';
import { stayNights } from '@/lib/hotel-calendar';

describe('stay nights follow Baku civil dates', () => {
  it('14:00 arrival and 12:00 departure are the calendar difference', () => {
    const checkIn = new Date('2026-11-25T10:00:00.000Z');
    const checkOut = new Date('2026-12-16T08:00:00.000Z');
    expect(stayNights(checkIn, checkOut)).toBe(21);
    expect(countNights(checkIn, checkOut)).toBe(21);
  });

  it('a checkout that is still the previous UTC date but already the Baku departure day counts that Baku night', () => {
    const checkIn = new Date('2026-11-25T10:00:00.000Z');
    const checkOut = new Date('2026-12-15T22:00:00.000Z');
    expect(stayNights(checkIn, checkOut)).toBe(21);
    expect(countNights(checkIn, checkOut)).toBe(21);
  });

  it('same civil day is zero nights', () => {
    const checkIn = new Date('2026-11-25T10:00:00.000Z');
    const checkOut = new Date('2026-11-25T08:00:00.000Z');
    expect(stayNights(checkIn, checkOut)).toBe(0);
  });
});
