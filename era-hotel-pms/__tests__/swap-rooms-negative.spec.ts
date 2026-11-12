import { swapReservationRooms } from '@/lib/services/swap-rooms.service';
import { RoomTypeSettlementRequiredError } from '@/lib/services/room-move-request.service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    roomChangePlan: { updateMany: jest.fn() },
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

jest.mock('@/lib/satellite-audit', () => ({
  recordHotelAudit: jest.fn(),
}));

jest.mock('@/lib/reservation-audit', () => ({
  recordReservationAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/share-assignment.service', () => ({
  countRemainingInHouseOnDoor: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/lib/services/business-date.service', () => ({
  getCurrentBusinessDate: jest.fn().mockResolvedValue(new Date('2026-11-10T00:00:00.000Z')),
}));

jest.mock('@/lib/services/stay-slice.service', () => ({
  moveStayDoor: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/room-move-door.service', () => ({
  settleVacatedDoorAfterMove: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    reservation: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    roomChangePlan: { updateMany: jest.Mock };
  };
};

const { recordRoomMove } = jest.requireMock('@/lib/services/room-occupancy-log.service') as {
  recordRoomMove: jest.Mock;
};

const { countRemainingInHouseOnDoor } = jest.requireMock(
  '@/lib/services/share-assignment.service',
) as { countRemainingInHouseOnDoor: jest.Mock };

const { settleVacatedDoorAfterMove } = jest.requireMock(
  '@/lib/services/room-move-door.service',
) as { settleVacatedDoorAfterMove: jest.Mock };

function stay(over: Record<string, unknown> = {}) {
  return {
    id: 'a',
    organizationId: 'org',
    groupId: null,
    isLocked: false,
    status: 'IN_HOUSE',
    roomId: 'r1',
    roomTypeId: 't1',
    givenRoomTypeId: null,
    checkInDate: new Date('2026-11-08T12:00:00.000Z'),
    checkOutDate: new Date('2026-11-14T12:00:00.000Z'),
    room: { id: 'r1', roomNumber: '502', roomTypeId: 't1' },
    ratePlan: null,
    ...over,
  };
}

describe('swapReservationRooms gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.reservation.findFirst.mockResolvedValue(null);
    prisma.reservation.findMany.mockImplementation(async () => [
      { id: 'a', roomId: 'r1' },
      { id: 'b', roomId: 'r2' },
    ]);
    prisma.reservation.update.mockResolvedValue({});
    prisma.roomChangePlan.updateMany.mockResolvedValue({ count: 0 });
  });

  it('rejects a stay swapped with itself', async () => {
    await expect(swapReservationRooms('a', 'a')).rejects.toThrow(/itself/);
  });

  it('rejects a stay that is not in house', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(stay({ id: 'b', status: 'CONFIRMED', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/in-house/);
  });

  it('rejects stays from different organizations', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(stay({ id: 'b', organizationId: 'other', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/organizations/);
  });

  it('rejects a locked card', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay({ isLocked: true }))
      .mockResolvedValueOnce(stay({ id: 'b', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/Unlock/);
  });

  it('rejects swap when either stay lacks a room', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(stay({ id: 'b', roomId: null, room: null }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/assigned room/);
  });

  it('rejects a shared door', async () => {
    countRemainingInHouseOnDoor.mockResolvedValueOnce(1);
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(stay({ id: 'b', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/shared/);
  });

  it('rejects a class change without a settlement answer', async () => {
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(
        stay({ id: 'b', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't2' } }),
      );
    await expect(swapReservationRooms('a', 'b')).rejects.toBeInstanceOf(RoomTypeSettlementRequiredError);
  });

  it('rejects when the longer stay would land on a booked door', async () => {
    prisma.reservation.findFirst.mockResolvedValueOnce({ id: 'c' });
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(stay({ id: 'b', roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }));
    await expect(swapReservationRooms('a', 'b')).rejects.toThrow(/booked/);
  });

  it('swaps two separate in-house stays and can swap again', async () => {
    const second = stay({
      id: 'b',
      roomId: 'r2',
      room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' },
    });
    prisma.reservation.findUnique
      .mockResolvedValueOnce(stay())
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(
        stay({ roomId: 'r2', room: { id: 'r2', roomNumber: '1002', roomTypeId: 't1' } }),
      )
      .mockResolvedValueOnce(
        stay({ id: 'b', roomId: 'r1', room: { id: 'r1', roomNumber: '502', roomTypeId: 't1' } }),
      );
    prisma.reservation.findMany
      .mockResolvedValueOnce([
        { id: 'a', roomId: 'r1' },
        { id: 'b', roomId: 'r2' },
      ])
      .mockResolvedValueOnce([
        { id: 'a', roomId: 'r2' },
        { id: 'b', roomId: 'r1' },
      ]);

    await swapReservationRooms('a', 'b', { actorUserId: 'user-1' });
    await swapReservationRooms('a', 'b', { actorUserId: 'user-1' });

    expect(recordRoomMove).toHaveBeenCalledTimes(4);
    expect(recordRoomMove).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        reservationId: 'a',
        reasonCode: 'SWAP',
        createdByUserId: 'user-1',
        organizationId: 'org',
        fromRoomId: 'r1',
        toRoomId: 'r2',
        notes: expect.stringContaining('swap-with:1002'),
      }),
    );
    expect(settleVacatedDoorAfterMove).not.toHaveBeenCalled();
  });
});
