import { resolveStayWindowPlane } from '@/lib/stay-window-plane';

describe('resolveStayWindowPlane', () => {
  const today = '2026-09-10';

  it('shows red landing on check-in date', () => {
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-10',
        checkOut: '2026-09-20',
        status: 'CONFIRMED',
        todayKey: today,
      }),
    ).toBe('arrival');
  });

  it('shows red takeoff on check-out date', () => {
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-01',
        checkOut: '2026-09-10',
        status: 'IN_HOUSE',
        todayKey: today,
      }),
    ).toBe('departure');
  });

  it('shows yellow early-checkout only IN_HOUSE strictly between dates', () => {
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-01',
        checkOut: '2026-09-20',
        status: 'IN_HOUSE',
        todayKey: today,
      }),
    ).toBe('earlyCheckout');
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-01',
        checkOut: '2026-09-20',
        status: 'CONFIRMED',
        todayKey: today,
      }),
    ).toBeNull();
  });
});
