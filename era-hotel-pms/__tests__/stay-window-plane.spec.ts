import { hotelStayDayGap, resolveStayWindowPlane, stayActionForPlane } from '@/lib/stay-window-plane';

describe('resolveStayWindowPlane', () => {
  const today = '2026-09-10';

  it('shows early arrival before the check-in date', () => {
    const kind = resolveStayWindowPlane({
      checkIn: '2026-09-12',
      checkOut: '2026-09-20',
      status: 'CONFIRMED',
      todayKey: today,
    });
    expect(kind).toBe('earlyArrival');
    expect(stayActionForPlane(kind)).toBe('earlyCheckIn');
    expect(hotelStayDayGap('2026-09-12', today)).toBe(2);
  });

  it('shows arrival on the check-in date', () => {
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-10',
        checkOut: '2026-09-20',
        status: 'CONFIRMED',
        todayKey: today,
      }),
    ).toBe('arrival');
  });

  it('shows early checkout while the guest is in house before departure', () => {
    expect(
      resolveStayWindowPlane({
        checkIn: '2026-09-01',
        checkOut: '2026-09-20',
        status: 'IN_HOUSE',
        todayKey: today,
      }),
    ).toBe('earlyCheckout');
  });

  it('shows departure on the check-out date', () => {
    const kind = resolveStayWindowPlane({
      checkIn: '2026-09-01',
      checkOut: '2026-09-10',
      status: 'IN_HOUSE',
      todayKey: today,
    });
    expect(kind).toBe('departure');
    expect(stayActionForPlane(kind)).toBe('checkOut');
  });
});
