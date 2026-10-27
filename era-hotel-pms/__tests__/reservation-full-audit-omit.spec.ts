jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    folio: {
      findFirst: jest.fn(),
    },
    folioCharge: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

jest.mock('@/lib/reservation-audit', () => ({
  loadReservationAuditSnapshot: jest.fn().mockResolvedValue({ fields: [] }),
  recordReservationDiff: jest.fn(),
}));

describe('patchReservationFull audit omit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not pass Request audit into prisma.reservation.update', async () => {
    const { prisma } = await import('@/lib/prisma');
    const existing = {
      id: 'res-1',
      status: 'CONFIRMED',
      organizationId: 'org-1',
      guestId: 'g-1',
      guest: { id: 'g-1', fullName: 'Nadejda Kominova', sex: 'F' },
      paxGuests: [],
      shareEligible: false,
      shareGender: null,
      adults: 1,
      roomId: 'room-304',
      roomTypeId: 'type-1',
      ratePlanId: 'rp-1',
      mealPlanId: 'mp-1',
      givenRoomTypeId: null,
      checkInDate: new Date('2026-10-15T10:00:00.000Z'),
      checkOutDate: new Date('2026-10-25T08:00:00.000Z'),
      billingMode: 'NORMAL',
      partyBillingMode: 'EQUAL',
      useManualRate: false,
      roomPayer: 'GUEST',
      commissionBasis: 'NET',
      agencyId: null,
      companyId: null,
      salesContractId: null,
    };
    (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.folioCharge.count as jest.Mock).mockResolvedValue(0);
    (prisma.reservation.update as jest.Mock).mockImplementation(() => {
      throw new Error('stop-after-update');
    });

    const { patchReservationFull } = await import(
      '@/lib/services/reservation-full.service'
    );
    const request = { headers: { append() {} } } as unknown as Request;

    await expect(
      patchReservationFull('res-1', {
        discountActive: true,
        audit: { userId: 'user-1', request },
      }),
    ).rejects.toThrow('stop-after-update');

    const payload = (prisma.reservation.update as jest.Mock).mock.calls[0][0];
    expect(payload.data.audit).toBeUndefined();
    expect(payload.data.discountActive).toBe(true);
    expect(payload.data.request).toBeUndefined();
  });
});
