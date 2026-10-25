import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { doorClashWindow, hotelDateKey, staysOverlap } from '@/lib/hotel-calendar';

const today = '2026-10-25';

describe('doorClashWindow', () => {
  it('starts an in-house move at today and ignores a slice that already ended', () => {
    const window = doorClashWindow('IN_HOUSE', '2026-10-17', '2026-10-31', today);
    expect(window).not.toBeNull();
    expect(hotelDateKey(window!.from)).toBe(today);
    expect(hotelDateKey(window!.to)).toBe('2026-10-31');
    expect(
      staysOverlap(window!.from, window!.to, bakuCivilUtcDate('2026-10-20'), bakuCivilUtcDate('2026-10-22')),
    ).toBe(false);
    expect(
      staysOverlap(window!.from, window!.to, bakuCivilUtcDate('2026-10-24'), bakuCivilUtcDate('2026-11-03')),
    ).toBe(true);
  });

  it('keeps the whole stay for a guest who has not checked in', () => {
    const window = doorClashWindow('CONFIRMED', '2026-10-17', '2026-10-31', today);
    expect(hotelDateKey(window!.from)).toBe('2026-10-17');
    expect(
      staysOverlap(window!.from, window!.to, bakuCivilUtcDate('2026-10-20'), bakuCivilUtcDate('2026-10-22')),
    ).toBe(true);
  });

  it('has no remaining night when checkout is today', () => {
    expect(doorClashWindow('IN_HOUSE', '2026-10-17', '2026-10-25', today)).toBeNull();
  });
});
