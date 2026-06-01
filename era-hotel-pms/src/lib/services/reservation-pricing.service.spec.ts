import { recalcReservationDailyRates, chargeAllRoomNights } from './reservation-pricing.service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservationDailyRate: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    revenueCode: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

jest.mock('@/lib/services/contract-pricing.service', () => ({
  quoteBookingRate: jest.fn().mockResolvedValue({
    adjustedNightly: 100,
    nights: 2,
    totalAmount: 200,
  }),
}));

jest.mock('@/lib/services/folio.service', () => ({
  postCharge: jest.fn().mockResolvedValue({ id: 'ch1' }),
}));

describe('reservation-pricing.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recalc throws when reservation locked', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue({
      id: 'r1',
      isLocked: true,
      ratePlanId: 'rp1',
      checkInDate: new Date('2026-06-01'),
      checkOutDate: new Date('2026-06-03'),
      agencyId: null,
      useManualRate: false,
      manualDailyRate: null,
      dailyRates: [],
      ratePlan: { pricePerNight: 100 },
    });
    await expect(recalcReservationDailyRates('r1')).rejects.toThrow('locked');
  });
});
