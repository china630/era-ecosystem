import { stayListHasInHouse } from '@/lib/occupied-hk-lock';

describe('occupied HK lock', () => {
  it('locks FO cleanliness only for IN_HOUSE, not a confirmed assignment', () => {
    expect(stayListHasInHouse([{ status: 'CONFIRMED' }])).toBe(false);
    expect(stayListHasInHouse([{ status: 'IN_HOUSE' }])).toBe(true);
    expect(stayListHasInHouse([])).toBe(false);
  });

  it('refuses a cleanliness PATCH while the door is in-house', async () => {
    jest.resetModules();
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        room: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'r1',
            hkCondition: 'DIRTY',
            inventoryStatus: 'IN_SERVICE',
          }),
        },
        reservation: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      },
    }));
    const { updateRoomAxes } = await import('@/lib/services/room.service');
    const { OccupiedHkLockedError: Locked } = await import('@/lib/occupied-hk-lock');
    await expect(updateRoomAxes('r1', 'CLEAN', 'IN_SERVICE')).rejects.toBeInstanceOf(Locked);
  });

  it('keeps current cleanliness when an occupied door is taken OOO', async () => {
    jest.resetModules();
    const update = jest.fn().mockResolvedValue({ id: 'r1', hkCondition: 'CLEAN' });
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        room: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'r1',
            hkCondition: 'CLEAN',
            inventoryStatus: 'IN_SERVICE',
          }),
          update,
        },
        reservation: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      },
    }));
    const { updateRoomStatus } = await import('@/lib/services/room.service');
    await updateRoomStatus('r1', 'OOO');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hkCondition: 'CLEAN', inventoryStatus: 'OOO' }),
      }),
    );
  });

  it('allows the same cleanliness write on an occupied door', async () => {
    jest.resetModules();
    const update = jest.fn().mockResolvedValue({ id: 'r1' });
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        room: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'r1',
            hkCondition: 'DIRTY',
            inventoryStatus: 'IN_SERVICE',
          }),
          update,
        },
        reservation: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      },
    }));
    const { updateRoomAxes } = await import('@/lib/services/room.service');
    await expect(updateRoomAxes('r1', 'DIRTY', 'IN_SERVICE')).resolves.toBeDefined();
    expect(update).toHaveBeenCalled();
  });

  it('keeps cleanliness when an occupied door is taken OOS', async () => {
    jest.resetModules();
    const update = jest.fn().mockResolvedValue({ id: 'r1' });
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        room: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'r1',
            hkCondition: 'CLEAN',
            inventoryStatus: 'IN_SERVICE',
          }),
          update,
        },
        reservation: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
        housekeepingTask: { create: jest.fn().mockResolvedValue({ id: 't1' }) },
      },
    }));
    const { setRoomOOS } = await import('@/lib/services/room.service');
    await setRoomOOS('r1', 2, 'lock');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hkCondition: 'CLEAN', inventoryStatus: 'OOS' }),
      }),
    );
  });
});
