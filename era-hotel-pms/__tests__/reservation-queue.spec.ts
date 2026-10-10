import { reservationQueueWhere } from '@/lib/reservation-queue';

describe('reservationQueueWhere', () => {
  const today = '2026-10-10';

  it('keeps open bookings from today forward, including today before check-in', () => {
    const where = reservationQueueWhere({ queue: 'bookings', today });
    expect(where.status).toEqual({ in: ['OPTION', 'CONFIRMED'] });
    expect(where.checkInDate).toEqual({ gte: new Date('2026-10-10T00:00:00.000Z') });
  });

  it('does not let a past from-date pull yesterday into bookings', () => {
    const where = reservationQueueWhere({
      queue: 'bookings',
      today,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-20',
    });
    expect(where.checkInDate).toEqual({
      gte: new Date('2026-10-10T00:00:00.000Z'),
      lte: new Date('2026-10-20T23:59:59.999Z'),
    });
  });

  it('overdue bookings are open stays that should already have arrived', () => {
    const where = reservationQueueWhere({ queue: 'bookings', today, overdue: true });
    expect(where.checkInDate).toEqual({ lt: new Date('2026-10-10T00:00:00.000Z') });
  });

  it('due out is in-house with checkout today and ignores the date pickers', () => {
    const where = reservationQueueWhere({
      queue: 'dueOut',
      today,
      dateFrom: '2026-01-01',
    });
    expect(where.status).toBe('IN_HOUSE');
    expect(where.checkOutDate).toEqual({
      gte: new Date('2026-10-10T00:00:00.000Z'),
      lte: new Date('2026-10-10T23:59:59.999Z'),
    });
  });
});
