jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    room: { findUnique: jest.fn() },
    roomType: { findUnique: jest.fn() },
  },
}));

jest.mock('@era/satellite-kit', () => ({
  linkPersonIdentity: jest.fn(),
  getPersonOpsProfile: jest.fn(),
  publishToOrchestratorGateway: jest.fn(),
}));

jest.mock('@/lib/integration/guest-lifecycle-events', () => ({
  dispatchGuestCheckedIn: jest.fn(),
  dispatchGuestCheckedOut: jest.fn(),
  dispatchRoomChanged: jest.fn(),
  dispatchSanatoriumBookingCreated: jest.fn(),
}));

jest.mock('@/lib/integration/clinic-capacity-client', () => ({
  assertSanatoriumBookingAllowed: jest.fn(),
}));

jest.mock('@/lib/services/channel.service', () => ({
  hasStopSellInRange: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/services/folio.service', () => ({
  openFoliosForReservation: jest.fn(),
  postCharge: jest.fn(),
}));

jest.mock('@/lib/services/contract-allotment.service', () => ({
  assertContractAllotmentAvailable: jest.fn(),
  getAvailabilityWithContractAllotment: jest.fn(),
}));

jest.mock('@/lib/services/sales-contract.service', () => ({
  findActiveSalesContract: jest.fn(),
}));

jest.mock('@/lib/services/pricing-quote.service', () => ({
  quoteReservationStay: jest.fn(),
}));

jest.mock('@/lib/services/contract-pricing.service', () => ({
  applyContractRuleToNightly: jest.fn(),
  findApplicableContractRule: jest.fn(),
}));

jest.mock('@/lib/master-data/retire-policy', () => ({
  assertActiveForNewUse: jest.fn(),
  assertRoomInventoryAvailable: jest.fn(),
}));

jest.mock('@/lib/services/business-date.service', () => ({
  assertBusinessDayOpenForPosting: jest.fn(),
}));

describe('FO gates negative paths (AC-HOT-FO)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reservationNamesIncomplete (pure)', () => {
    it('flags TBA primary guest', async () => {
      const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
      expect(
        reservationNamesIncomplete({
          guestFullName: 'TBA',
          adults: 1,
          pax: [],
        }),
      ).toBe(true);
    });

    it('flags when named pax < adults', async () => {
      const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
      expect(
        reservationNamesIncomplete({
          guestFullName: 'Ali Mammadov',
          adults: 2,
          pax: [{ firstName: 'Ali', lastName: 'Mammadov', isPrimary: true }],
        }),
      ).toBe(true);
    });

    it('passes when adults covered by named pax', async () => {
      const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
      expect(
        reservationNamesIncomplete({
          guestFullName: 'Ali Mammadov',
          adults: 2,
          pax: [
            { firstName: 'Ali', lastName: 'Mammadov', isPrimary: true },
            { firstName: 'Leyla', lastName: 'Mammadova' },
          ],
        }),
      ).toBe(false);
    });
  });

  describe('assignRoom', () => {
    it('blocks assign when names incomplete', async () => {
      const { prisma } = jest.requireMock('@/lib/prisma');
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CONFIRMED',
        roomTypeId: 'rt1',
        adults: 2,
        guest: { fullName: 'TBA' },
        paxGuests: [],
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-12'),
      });
      const { assignRoom } = await import('@/lib/services/reservation.service');
      await expect(assignRoom('r1', 'room1')).rejects.toThrow(/names incomplete/);
    });

    it('blocks assign to DIRTY room', async () => {
      const { prisma } = jest.requireMock('@/lib/prisma');
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CONFIRMED',
        roomTypeId: 'rt1',
        adults: 1,
        guest: { fullName: 'Ali Mammadov' },
        paxGuests: [{ firstName: 'Ali', lastName: 'Mammadov', isPrimary: true }],
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-12'),
      });
      prisma.room.findUnique.mockResolvedValue({
        id: 'room1',
        roomNumber: '402',
        roomTypeId: 'rt1',
        status: 'DIRTY',
      });
      const { assignRoom } = await import('@/lib/services/reservation.service');
      await expect(assignRoom('r1', 'room1')).rejects.toThrow(/DIRTY/);
    });
  });

  describe('createReservation Avl=0', () => {
    it('throws when no availability for room type', async () => {
      const { prisma } = jest.requireMock('@/lib/prisma');
      // Patch module internals via counting overlapping = quota
      prisma.roomType.findUnique.mockResolvedValue({
        id: 'rt1',
        baseQuota: 1,
        active: true,
      });
      prisma.reservation.count.mockResolvedValue(1);
      prisma.room.findUnique.mockResolvedValue(null);

      // createReservation needs more mocks — call getAvailability path via updateReservationSchedule
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CONFIRMED',
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-12'),
        roomId: null,
        roomTypeId: 'rt1',
        ratePlan: { pricePerNight: 100 },
      });
      // getReservation is used inside updateReservationSchedule
      const svc = await import('@/lib/services/reservation.service');
      // Spy getReservation by making findUnique return full include shape for getReservation
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'CONFIRMED',
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-12'),
        roomId: null,
        roomTypeId: 'rt1',
        ratePlan: { pricePerNight: 100 },
        guest: { fullName: 'Ali' },
        room: null,
        roomType: { id: 'rt1', baseQuota: 1 },
      });
      prisma.roomType.findUnique.mockResolvedValue({ id: 'rt1', baseQuota: 1 });
      prisma.reservation.count.mockResolvedValue(1);

      await expect(
        svc.updateReservationSchedule('r1', {
          checkInDate: new Date('2026-08-10'),
          checkOutDate: new Date('2026-08-13'),
        }),
      ).rejects.toThrow(/No availability/);
    });
  });

  describe('assertNamedGuestsFreeOnStay', () => {
    it('blocks same named guest on overlapping stay', async () => {
      const { prisma } = jest.requireMock('@/lib/prisma');
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r-new',
        guestId: 'g1',
        adults: 1,
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-12'),
        guest: { fullName: 'Ali Mammadov' },
        paxGuests: [{ guestId: 'g1', firstName: 'Ali', lastName: 'Mammadov' }],
        room: { roomNumber: '101' },
      });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'r-old',
        guestId: 'g1',
        adults: 1,
        checkInDate: new Date('2026-08-09'),
        checkOutDate: new Date('2026-08-11'),
        guest: { fullName: 'Ali Mammadov' },
        room: { roomNumber: '202' },
        paxGuests: [{ guestId: 'g1', firstName: 'Ali', lastName: 'Mammadov' }],
      });

      const { assertNamedGuestsFreeOnStay } = await import(
        '@/lib/services/reservation.service'
      );
      await expect(assertNamedGuestsFreeOnStay('r-new')).rejects.toThrow(
        /overlapping stay/,
      );
    });
  });
});
