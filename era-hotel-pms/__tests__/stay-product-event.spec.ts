import { isSatelliteHotelStayProductChanged } from '@era/contracts';

describe('SATELLITE_HOTEL_STAY_PRODUCT_CHANGED', () => {
  it('parses clinic remaining replan envelope', () => {
    const ok = isSatelliteHotelStayProductChanged({
      type: 'SATELLITE_HOTEL_STAY_PRODUCT_CHANGED',
      organizationId: 'org',
      correlationId: 'c1',
      occurredAt: new Date().toISOString(),
      payload: {
        reservationId: 'r1',
        programCode: 'MED-B',
        previousProgramCode: 'MED-A',
        effectiveDate: '2026-08-24',
        newProgramCode: 'MED-B',
        globalPersonId: 'gp1',
        roomNumber: '101',
        checkInDate: '2026-08-20',
        checkOutDate: '2026-08-27',
      },
    });
    expect(ok).toBe(true);
  });
});
