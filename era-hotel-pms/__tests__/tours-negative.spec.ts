jest.mock('@/lib/hotel-module-gate', () => ({
  requireHotelModule: jest.fn(),
}));
jest.mock('@/lib/auth/session', () => ({
  getSessionFromHeaders: jest.fn(async () => ({ role: 'Hotel_Admin' })),
}));
jest.mock('@/lib/auth/require', () => ({
  assertPermission: jest.fn(),
}));
jest.mock('@/lib/services/tour.service', () => ({
  addTourBooking: jest.fn(),
  TourConflictError: class TourConflictError extends Error {
    constructor(m: string) {
      super(m);
      this.name = 'TourConflictError';
    }
  },
}));

import { addTourBooking } from '@/lib/services/tour.service';
import { POST as postBooking } from '../app/api/tours/departures/[id]/bookings/route';

describe('tours API negatives', () => {
  it('maps IN_HOUSE rule from service', async () => {
    (addTourBooking as jest.Mock).mockRejectedValue(new Error('Guest must be IN_HOUSE'));
    const res = await postBooking(
      new Request('http://localhost/api/tours/departures/d1/bookings', {
        method: 'POST',
        body: JSON.stringify({ reservationId: '00000000-0000-4000-8000-000000000001' }),
      }),
      { params: Promise.resolve({ id: 'd1' }) },
    );
    expect(res.status).toBe(400);
  });
});
