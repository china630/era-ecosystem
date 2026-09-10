import { swapReservationRooms } from '@/lib/services/swap-rooms.service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma: p } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, unknown> };
      return fn(p);
    }),
  },
}));

jest.mock('@/lib/services/room-occupancy-log.service', () => ({
  recordRoomMove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/door-type.policy', () => ({
  physicalTypeAllowedForDoor: jest.fn().mockReturnValue({ ok: true }),
}));

jest.mock('@/lib/integration/guest-lifecycle-events', () => ({
  dispatchRoomChanged: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/reservation-submodals.service', () => ({
  addReservationTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
}));

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    reservation: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
};

describe('swapReservationRooms gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects swap across different booking groups', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce({
        id: 'a',
        groupId: 'g1',
        status: 'IN_HOUSE',
        roomId: 'r1',
        roomTypeId: 't1',
        givenRoomTypeId: null,
        room: { id: 'r1', roomNumber: '101', roomTypeId: 't1' },
        ratePlan: null,
      })
      .mockResolvedValueOnce({
        id: 'b',
        groupId: 'g2',
        status: 'IN_HOUSE',
        roomId: 'r2',
        roomTypeId: 't1',
        givenRoomTypeId: null,
        room: { id: 'r2', roomNumber: '102', roomTypeId: 't1' },
        ratePlan: null,
      });
    await expect(swapReservationRooms('a', 'b')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/same booking group/),
    });
  });

  it('rejects swap when either stay lacks a room', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce({
        id: 'a',
        groupId: 'g1',
        status: 'IN_HOUSE',
        roomId: 'r1',
        roomTypeId: 't1',
        givenRoomTypeId: null,
        room: { id: 'r1', roomNumber: '101', roomTypeId: 't1' },
        ratePlan: null,
      })
      .mockResolvedValueOnce({
        id: 'b',
        groupId: 'g1',
        status: 'IN_HOUSE',
        roomId: null,
        roomTypeId: 't1',
        givenRoomTypeId: null,
        room: null,
        ratePlan: null,
      });
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/assigned room/);
  });
});
