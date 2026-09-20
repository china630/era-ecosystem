import {
  occupancyBucketForPax,
  decrementOccupancy,
  countLivePax,
  previewOccupancyAfterDepart,
} from '@/lib/occupancy-party';
import { departGuestFromStay } from '@/lib/services/depart-guest.service';
import { moveGuestBetweenStays } from '@/lib/services/move-guest.service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservationGuest: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    room: { update: jest.fn() },
    housekeepingTask: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma: p } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, unknown> };
      return fn(p);
    }),
  },
}));

jest.mock('@/lib/services/share-assignment.service', () => ({
  isEffectiveShare: jest.fn(({ shareEligible, adults }: { shareEligible?: boolean; adults?: number }) =>
    Boolean(shareEligible && adults === 1),
  ),
}));

jest.mock('@/lib/services/folio.service', () => ({
  closeFolio: jest.fn(),
}));

jest.mock('@/lib/services/reservation-pricing.service', () => ({
  recalcReservationDailyRates: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/integration/guest-lifecycle-events', () => ({
  dispatchGuestDeparted: jest.fn().mockResolvedValue(undefined),
  dispatchGuestMoved: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/reservation-submodals.service', () => ({
  addReservationTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
}));

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    reservation: { findUnique: jest.Mock; update: jest.Mock };
    reservationGuest: { update: jest.Mock; updateMany: jest.Mock };
    room: { update: jest.Mock };
    housekeepingTask: { create: jest.Mock };
    $transaction: jest.Mock;
  };
};

describe('depart-guest occupancy helpers', () => {
  it('maps ages to Nafta child bands', () => {
    expect(occupancyBucketForPax({ age: null })).toBe('adults');
    expect(occupancyBucketForPax({ age: 35 })).toBe('adults');
    expect(occupancyBucketForPax({ age: 8 })).toBe('children11_6');
    expect(occupancyBucketForPax({ age: 4 })).toBe('children5_2');
    expect(occupancyBucketForPax({ age: 1 })).toBe('children1_0');
  });

  it('decrements occupancy without going negative', () => {
    expect(
      decrementOccupancy(
        { adults: 2, children11_6: 0, children5_2: 0, children1_0: 0 },
        'adults',
      ),
    ).toEqual({ adults: 1, children11_6: 0, children5_2: 0, children1_0: 0 });
  });

  it('counts live pax excluding departed and optional id', () => {
    const rows = [
      { id: 'a', departedAt: null },
      { id: 'b', departedAt: new Date() },
      { id: 'c', departedAt: null },
    ];
    expect(countLivePax(rows)).toBe(2);
    expect(countLivePax(rows, 'a')).toBe(1);
  });

  it('previews occupancy after depart', () => {
    expect(
      previewOccupancyAfterDepart(
        { adults: 2, children11_6: 0, children5_2: 0, children1_0: 0 },
        { age: 30 },
      ),
    ).toEqual({ adults: 1, children11_6: 0, children5_2: 0, children1_0: 0 });
  });
});

describe('departGuestFromStay gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 for share-pool stays', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      status: 'IN_HOUSE',
      shareEligible: true,
      shareGender: 'M',
      adults: 1,
      children11_6: 0,
      children5_2: 0,
      children1_0: 0,
      paxGuests: [{ id: 'p1', departedAt: null, age: 30, guest: null }],
      guest: null,
      room: null,
      ratePlan: null,
      agency: null,
      folios: [],
    });
    await expect(departGuestFromStay('res-1', 'p1')).rejects.toMatchObject({
      message: expect.stringMatching(/Share-pool/),
      status: 409,
    });
  });

  it('returns needs_checkout when last live pax', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      status: 'IN_HOUSE',
      shareEligible: false,
      shareGender: null,
      adults: 1,
      children11_6: 0,
      children5_2: 0,
      children1_0: 0,
      paxGuests: [{ id: 'p1', departedAt: null, age: 30, guest: null }],
      guest: null,
      room: null,
      ratePlan: null,
      agency: null,
      folios: [],
    });
    const result = await departGuestFromStay('res-1', 'p1');
    expect(result).toMatchObject({
      kind: 'needs_checkout',
      reservationId: 'res-1',
      folioPath: '/folio/res-1',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('moveGuestBetweenStays gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 when groups differ', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce({
        id: 'from',
        groupId: 'g1',
        shareEligible: false,
        adults: 2,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [
          { id: 'p1', departedAt: null, age: 30, isPrimary: true, guestId: null, guest: null },
          { id: 'p2', departedAt: null, age: 28, isPrimary: false, guestId: null, guest: null },
        ],
        guest: null,
        room: null,
        ratePlan: null,
        group: { id: 'g1' },
      })
      .mockResolvedValueOnce({
        id: 'to',
        groupId: 'g2',
        shareEligible: false,
        adults: 1,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [],
        room: null,
        ratePlan: null,
        group: { id: 'g2' },
        partyBillingMode: 'PRIMARY',
      });
    await expect(moveGuestBetweenStays('from', 'p1', 'to')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/same booking group/),
    });
  });

  it('returns 409 when move would empty the source stay', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce({
        id: 'from',
        groupId: 'g1',
        shareEligible: false,
        adults: 1,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [
          { id: 'p1', departedAt: null, age: 30, isPrimary: true, guestId: null, guest: null },
        ],
        guest: null,
        room: null,
        ratePlan: null,
        group: { id: 'g1' },
      })
      .mockResolvedValueOnce({
        id: 'to',
        groupId: 'g1',
        shareEligible: false,
        adults: 1,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [],
        room: null,
        ratePlan: null,
        group: { id: 'g1' },
        partyBillingMode: 'PRIMARY',
      });
    await expect(moveGuestBetweenStays('from', 'p1', 'to')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/empty stay/),
    });
  });

  it('returns 409 for departed pax', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce({
        id: 'from',
        groupId: 'g1',
        shareEligible: false,
        adults: 2,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [
          { id: 'p1', departedAt: new Date(), age: 30, isPrimary: true, guestId: null, guest: null },
          { id: 'p2', departedAt: null, age: 28, isPrimary: false, guestId: null, guest: null },
        ],
        guest: null,
        room: null,
        ratePlan: null,
        group: { id: 'g1' },
      })
      .mockResolvedValueOnce({
        id: 'to',
        groupId: 'g1',
        shareEligible: false,
        adults: 1,
        children11_6: 0,
        children5_2: 0,
        children1_0: 0,
        paxGuests: [],
        room: null,
        ratePlan: null,
        group: { id: 'g1' },
        partyBillingMode: 'PRIMARY',
      });
    await expect(moveGuestBetweenStays('from', 'p1', 'to')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/departed/),
    });
  });
});
