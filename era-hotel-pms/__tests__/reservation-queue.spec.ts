import { RESERVATION_QUEUE_CODES, reservationQueueWhere } from '@/lib/reservation-queue';

describe('reservationQueueWhere', () => {
  const today = '2026-10-10';

  it('keeps open bookings from today forward, including today before check-in', () => {
    const where = reservationQueueWhere({ queue: 'bookings', today });
    expect(where.status).toEqual({ in: ['OPTION', 'CONFIRMED'] });
    expect(where.checkInDate).toEqual({ gte: new Date('2026-10-10T00:00:00.000+04:00') });
  });

  it('does not let a past from-date pull yesterday into bookings', () => {
    const where = reservationQueueWhere({
      queue: 'bookings',
      today,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-20',
    });
    expect(where.checkInDate).toEqual({
      gte: new Date('2026-10-10T00:00:00.000+04:00'),
      lte: new Date('2026-10-20T23:59:59.999+04:00'),
    });
  });

  it('overdue bookings are open stays that should already have arrived', () => {
    const where = reservationQueueWhere({ queue: 'bookings', today, overdue: true });
    expect(where.checkInDate).toEqual({ lt: new Date('2026-10-10T00:00:00.000+04:00') });
  });

  it('due out is in-house with checkout today and ignores the date pickers', () => {
    const where = reservationQueueWhere({
      queue: 'dueOut',
      today,
      dateFrom: '2026-01-01',
    });
    expect(where.status).toBe('IN_HOUSE');
    expect(where.checkOutDate).toEqual({
      gte: new Date('2026-10-10T00:00:00.000+04:00'),
      lte: new Date('2026-10-10T23:59:59.999+04:00'),
    });
  });

  it('realized arrivals match FO Status: check-in business day today (in-house or checked out)', () => {
    const where = reservationQueueWhere({
      queue: 'realizedArrivals',
      today,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
    expect(where.status).toEqual({ in: ['IN_HOUSE', 'CHECKED_OUT'] });
    expect(where.checkInDate).toBeUndefined();
    expect(where.stay).toEqual({
      is: {
        checkInBusinessDate: {
          gte: new Date('2026-10-10T00:00:00.000Z'),
          lt: new Date('2026-10-11T00:00:00.000Z'),
        },
      },
    });
  });

  it('realized departures are guests whose check-out business day is today', () => {
    const where = reservationQueueWhere({
      queue: 'realizedDepartures',
      today,
      dateFrom: '2026-01-01',
    });
    expect(where.status).toBe('CHECKED_OUT');
    expect(where.checkOutDate).toBeUndefined();
    expect(where.stay).toEqual({
      is: {
        checkOutBusinessDate: {
          gte: new Date('2026-10-10T00:00:00.000Z'),
          lt: new Date('2026-10-11T00:00:00.000Z'),
        },
      },
    });
  });

  it('puts expected departure before departed and realized departures after', () => {
    expect(RESERVATION_QUEUE_CODES.indexOf('dueOut')).toBeLessThan(
      RESERVATION_QUEUE_CODES.indexOf('departed'),
    );
    expect(RESERVATION_QUEUE_CODES.indexOf('departed')).toBeLessThan(
      RESERVATION_QUEUE_CODES.indexOf('realizedDepartures'),
    );
  });

  it('all sits before no-show and cancel and drops those statuses', () => {
    expect(RESERVATION_QUEUE_CODES.indexOf('all')).toBeLessThan(RESERVATION_QUEUE_CODES.indexOf('noShow'));
    expect(RESERVATION_QUEUE_CODES.indexOf('all')).toBeLessThan(RESERVATION_QUEUE_CODES.indexOf('cancel'));
    const where = reservationQueueWhere({ queue: 'all', today });
    expect(where.status).toEqual({ notIn: ['NO_SHOW', 'CANCELLED'] });
  });
});
