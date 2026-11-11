import { alertDueWithinTwoDays, stayTransferHints } from '../src/lib/stay-alert-icons';

describe('stay alert icons', () => {
  it('shows a transfer from two days before through the pickup day', () => {
    expect(alertDueWithinTwoDays('2026-11-13', '2026-11-11')).toBe(true);
    expect(alertDueWithinTwoDays('2026-11-14', '2026-11-11')).toBe(false);
    expect(alertDueWithinTwoDays('2026-11-10', '2026-11-11')).toBe(false);
  });

  it('keeps booked and confirmed transfers inside the window', () => {
    const hints = stayTransferHints(
      [
        { direction: 'IN', pickupAt: '2026-11-12T08:00:00.000Z', status: 'BOOKED' },
        { direction: 'OUT', pickupAt: '2026-11-20T08:00:00.000Z', status: 'CONFIRMED' },
        { direction: 'IN', pickupAt: '2026-11-12T08:00:00.000Z', status: 'DONE' },
        { direction: 'OUT', pickupAt: '2026-11-12T08:00:00.000Z', status: 'CANCELLED' },
      ],
      '2026-11-11',
    );
    expect(hints).toEqual([{ direction: 'IN', pickupOn: '2026-11-12' }]);
  });
});
