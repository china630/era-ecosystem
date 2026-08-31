import {
  assertShareInventory,
  breakShareReservation,
  countDoorsUsedOnNight,
  isEffectiveShare,
  maxDoorsUsedInRange,
  nextFreeShareBedIndex,
  nextShareBedIndex,
  normalizeShareGender,
  validateShareCandidate,
  type ShareReservationSlice,
} from '@/lib/services/share-assignment.service';
import { parseHotelNoon } from '@/lib/hotel-calendar';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    roomType: { findUnique: jest.fn() },
    reservation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    room: { update: jest.fn(), findUnique: jest.fn() },
    housekeepingTask: { create: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    roomType: { findUnique: jest.Mock };
    reservation: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    room: { update: jest.Mock; findUnique: jest.Mock };
    housekeepingTask: { create: jest.Mock };
  };
};

function slice(
  partial: Partial<ShareReservationSlice> & Pick<ShareReservationSlice, 'id'>,
): ShareReservationSlice {
  return {
    roomId: null,
    shareEligible: false,
    shareGender: null,
    adults: 1,
    checkInDate: new Date('2026-08-10T12:00:00Z'),
    checkOutDate: new Date('2026-08-15T12:00:00Z'),
    ...partial,
  };
}

describe('shared twin assignment (AC-HOT-FO-SHARE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeShareGender / validateShareCandidate', () => {
    it('requires gender for share', () => {
      expect(normalizeShareGender('M')).toBe('M');
      expect(normalizeShareGender('female')).toBe('F');
      expect(normalizeShareGender('X')).toBeNull();
      expect(() =>
        validateShareCandidate({ shareEligible: true, shareGender: null, adults: 1 }),
      ).toThrow(/Gender is required/);
    });

    it('rejects adults > 1 with share', () => {
      expect(() =>
        validateShareCandidate({ shareEligible: true, shareGender: 'M', adults: 2 }),
      ).toThrow(/single-adult/);
    });

    it('rejects OTA share', () => {
      expect(() =>
        validateShareCandidate({
          shareEligible: true,
          shareGender: 'M',
          adults: 1,
          isOta: true,
        }),
      ).toThrow(/OTA/);
    });
  });

  describe('isEffectiveShare / ungendered inventory', () => {
    it('ungendered shareEligible does not count as effective share', () => {
      expect(
        isEffectiveShare({ shareEligible: true, shareGender: null, adults: 1 }),
      ).toBe(false);
    });

    it('ungendered share does not consume a door slot', () => {
      const night = new Date('2026-08-10T00:00:00Z');
      const used = countDoorsUsedOnNight(
        [
          slice({
            id: 'u1',
            shareEligible: true,
            shareGender: null,
            adults: 1,
          }),
        ],
        night,
        2,
      );
      expect(used).toBe(0);
    });
  });

  describe('T2 gender pool inventory', () => {
    it('M confirmed consumes M door; F rejected when quota full', () => {
      const night = new Date('2026-08-10T00:00:00Z');
      const mStay = slice({
        id: 'm1',
        shareEligible: true,
        shareGender: 'M',
        adults: 1,
      });
      const fStay = slice({
        id: 'f1',
        shareEligible: true,
        shareGender: 'F',
        adults: 1,
        checkInDate: new Date('2026-08-08T12:00:00Z'),
        checkOutDate: new Date('2026-08-14T12:00:00Z'),
      });
      const withM = countDoorsUsedOnNight([mStay], night, 2);
      expect(withM).toBe(1);
      const withBoth = countDoorsUsedOnNight([mStay, fStay], night, 2);
      expect(withBoth).toBe(2);
      expect(withBoth > 1).toBe(true);
    });

    it('two same-gender share on one door = 1 door', () => {
      const night = new Date('2026-08-10T00:00:00Z');
      const used = countDoorsUsedOnNight(
        [
          slice({
            id: 's1',
            roomId: 'room-a',
            shareEligible: true,
            shareGender: 'M',
          }),
          slice({
            id: 's2',
            roomId: 'room-a',
            shareEligible: true,
            shareGender: 'M',
            checkInDate: new Date('2026-08-08T12:00:00Z'),
            checkOutDate: new Date('2026-08-12T12:00:00Z'),
          }),
        ],
        night,
        2,
      );
      expect(used).toBe(1);
    });

    it('three same-gender share on maxBed=3 = 1 door', () => {
      const night = new Date('2026-08-10T00:00:00Z');
      const used = countDoorsUsedOnNight(
        [
          slice({ id: 't1', roomId: 'trip', shareEligible: true, shareGender: 'M' }),
          slice({ id: 't2', roomId: 'trip', shareEligible: true, shareGender: 'M' }),
          slice({ id: 't3', roomId: 'trip', shareEligible: true, shareGender: 'M' }),
        ],
        night,
        3,
      );
      expect(used).toBe(1);
    });

    it('2M + 1F unassigned with maxBed=3 uses 2 doors', () => {
      const night = new Date('2026-08-10T00:00:00Z');
      const used = countDoorsUsedOnNight(
        [
          slice({ id: 'm1', shareEligible: true, shareGender: 'M' }),
          slice({ id: 'm2', shareEligible: true, shareGender: 'M' }),
          slice({ id: 'f1', shareEligible: true, shareGender: 'F' }),
        ],
        night,
        3,
      );
      expect(used).toBe(2);
    });
  });

  describe('nextShareBedIndex', () => {
    it('allocates 1..maxBed without hardcoding twin', () => {
      expect(nextShareBedIndex([], 3)).toBe(1);
      expect(nextShareBedIndex([{ shareBedIndex: 1 }], 3)).toBe(2);
      expect(nextShareBedIndex([{ shareBedIndex: 1 }, { shareBedIndex: 2 }], 3)).toBe(3);
      expect(() =>
        nextShareBedIndex([{ shareBedIndex: 1 }, { shareBedIndex: 2 }, { shareBedIndex: 3 }], 3),
      ).toThrow(/full/);
    });
  });

  describe('nextFreeShareBedIndex (per-night)', () => {
    it('assigns vacated bed 2 when A stays to 10th and B left on 5th', () => {
      const bed = nextFreeShareBedIndex({
        overlapping: [
          {
            id: 'a',
            checkInDate: parseHotelNoon('2026-06-01'),
            checkOutDate: parseHotelNoon('2026-06-10'),
            shareBedIndex: 1,
          },
          {
            id: 'b',
            checkInDate: parseHotelNoon('2026-06-01'),
            checkOutDate: parseHotelNoon('2026-06-05'),
            shareBedIndex: 2,
          },
        ],
        checkIn: parseHotelNoon('2026-06-06'),
        checkOut: parseHotelNoon('2026-06-12'),
        maxBed: 2,
      });
      expect(bed).toBe(2);
    });

    it('reuses bed 2 after a second turnover on the lower lane', () => {
      const bed = nextFreeShareBedIndex({
        overlapping: [
          {
            id: 'a',
            checkInDate: parseHotelNoon('2026-06-01'),
            checkOutDate: parseHotelNoon('2026-06-20'),
            shareBedIndex: 1,
          },
          {
            id: 'c',
            checkInDate: parseHotelNoon('2026-06-06'),
            checkOutDate: parseHotelNoon('2026-06-10'),
            shareBedIndex: 2,
          },
        ],
        checkIn: parseHotelNoon('2026-06-11'),
        checkOut: parseHotelNoon('2026-06-16'),
        maxBed: 2,
      });
      expect(bed).toBe(2);
    });

    it('does not treat non-overlapping same bed as full pool', () => {
      const bed = nextFreeShareBedIndex({
        overlapping: [
          {
            id: 'a',
            checkInDate: parseHotelNoon('2026-06-01'),
            checkOutDate: parseHotelNoon('2026-06-10'),
            shareBedIndex: 1,
          },
          {
            id: 'b',
            checkInDate: parseHotelNoon('2026-06-12'),
            checkOutDate: parseHotelNoon('2026-06-20'),
            shareBedIndex: 1,
          },
        ],
        checkIn: parseHotelNoon('2026-06-01'),
        checkOut: parseHotelNoon('2026-06-20'),
        maxBed: 2,
      });
      expect(bed).toBe(2);
    });

    it('null shareBedIndex on neighbor blocks a bed (no overlay on 1)', () => {
      const bed = nextFreeShareBedIndex({
        overlapping: [
          {
            id: 'a',
            checkInDate: parseHotelNoon('2026-06-01'),
            checkOutDate: parseHotelNoon('2026-06-10'),
            shareBedIndex: null,
          },
        ],
        checkIn: parseHotelNoon('2026-06-05'),
        checkOut: parseHotelNoon('2026-06-12'),
        maxBed: 2,
      });
      expect(bed).toBe(2);
    });
  });

  describe('assertShareInventory', () => {
    it('rejects when doors exceed quota', async () => {
      prisma.roomType.findUnique.mockResolvedValue({ baseQuota: 1, adultCapacity: 2 });
      prisma.reservation.findMany.mockResolvedValue([
        slice({ id: 'm1', shareEligible: true, shareGender: 'M' }),
      ]);

      await expect(
        assertShareInventory('rt-1', new Date('2026-08-10'), new Date('2026-08-15'), {
          shareEligible: true,
          shareGender: 'F',
          adults: 1,
        }),
      ).rejects.toThrow(/No availability/);
    });
  });

  describe('breakShareReservation', () => {
    it('refuses break when roommate remains', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        shareEligible: true,
        roomId: 'room-a',
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-15'),
      });
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'r2',
          shareEligible: true,
          shareGender: 'M',
          adults: 1,
          checkInDate: new Date('2026-08-11'),
          checkOutDate: new Date('2026-08-14'),
          guest: { fullName: 'Neighbor' },
        },
      ]);

      await expect(breakShareReservation('r1')).rejects.toThrow(/roommate remains/);
    });

    it('clears share when door has no roommate', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'r1',
        shareEligible: true,
        roomId: 'room-a',
        checkInDate: new Date('2026-08-10'),
        checkOutDate: new Date('2026-08-15'),
      });
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.update.mockResolvedValue({ id: 'r1', shareEligible: false });

      await breakShareReservation('r1');
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareEligible: false,
            shareGender: null,
            shareBedIndex: null,
          }),
        }),
      );
    });
  });

  describe('maxDoorsUsedInRange', () => {
    it('uses peak night across stay', () => {
      const from = new Date('2026-08-10');
      const to = new Date('2026-08-12');
      const max = maxDoorsUsedInRange(
        [
          slice({ id: 'e1', shareEligible: false, adults: 1 }),
          slice({
            id: 'e2',
            shareEligible: false,
            adults: 1,
            checkInDate: new Date('2026-08-11'),
            checkOutDate: new Date('2026-08-13'),
          }),
        ],
        from,
        to,
        2,
      );
      expect(max).toBe(2);
    });
  });
});

describe('share-assignment pure math', () => {
  it('ceil unassigned share by gender', () => {
    const night = new Date('2026-08-10T00:00:00Z');
    const used = countDoorsUsedOnNight(
      [
        slice({ id: 'm1', shareEligible: true, shareGender: 'M' }),
        slice({ id: 'm2', shareEligible: true, shareGender: 'M' }),
        slice({ id: 'm3', shareEligible: true, shareGender: 'M' }),
      ],
      night,
      2,
    );
    expect(used).toBe(2);
  });
});
