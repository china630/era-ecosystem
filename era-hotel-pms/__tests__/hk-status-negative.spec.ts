import {
  canQuickBookRoom,
  computeRackDisplayState,
  rackNumberTextClass,
} from '@/lib/room-rack-display';

describe('HK status / assignable proof (AC-HOT-HK)', () => {
  it('DIRTY rooms are cleaning on rack and not assignable for quick book', () => {
    const room = { status: 'DIRTY' as const, reservations: [] };
    expect(computeRackDisplayState(room)).toBe('cleaning');
    expect(canQuickBookRoom({ status: 'DIRTY', rackDisplayState: 'cleaning' })).toBe(false);
    expect(canQuickBookRoom({ status: 'DIRTY', rackDisplayState: 'vacant' })).toBe(false);
  });

  it('CLEAN / INSPECTED / AVAILABLE vacant rooms are assignable', () => {
    for (const status of ['CLEAN', 'INSPECTED', 'AVAILABLE'] as const) {
      expect(canQuickBookRoom({ status, rackDisplayState: 'vacant' })).toBe(true);
    }
  });

  it('OOO / MAINTENANCE are notReady and not assignable', () => {
    expect(computeRackDisplayState({ status: 'OOO', reservations: [] })).toBe('notReady');
    expect(canQuickBookRoom({ status: 'OOO', rackDisplayState: 'notReady' })).toBe(false);
    expect(computeRackDisplayState({ status: 'MAINTENANCE', reservations: [] })).toBe(
      'notReady',
    );
  });

  it('badge text for DIRTY stays orange even if display vacant (badge vs assignable)', () => {
    // Number color follows HK status; assignable requires CLEAN/INSPECTED/AVAILABLE
    expect(rackNumberTextClass({ status: 'DIRTY' })).toContain('orange');
    expect(canQuickBookRoom({ status: 'DIRTY', rackDisplayState: 'vacant' })).toBe(false);
  });

  it('completeTask target statuses CLEAN and INSPECTED are allowed transitions', async () => {
    jest.resetModules();
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        housekeepingTask: {
          findUnique: jest.fn().mockResolvedValue({ id: 't1', roomId: 'room1' }),
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            housekeepingTask: {
              update: jest.fn().mockResolvedValue({ id: 't1', status: 'DONE' }),
            },
            room: {
              update: jest.fn().mockImplementation(({ data }: { data: { status: string } }) =>
                Promise.resolve({ id: 'room1', status: data.status }),
              ),
            },
          };
          return fn(tx);
        }),
      },
    }));
    const { completeTask, markInspected } = await import(
      '@/lib/services/housekeeping.service'
    );
    const cleaned = await completeTask('t1', 'CLEAN');
    expect(cleaned).toBeDefined();
    const { prisma } = jest.requireMock('@/lib/prisma');
    prisma.room = {
      update: jest.fn().mockResolvedValue({ id: 'room1', status: 'INSPECTED' }),
    };
    // markInspected uses prisma.room.update directly
    jest.resetModules();
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        room: {
          update: jest.fn().mockResolvedValue({ id: 'room1', status: 'INSPECTED' }),
        },
      },
    }));
    const hk = await import('@/lib/services/housekeeping.service');
    await expect(hk.markInspected('room1')).resolves.toMatchObject({ status: 'INSPECTED' });
  });
});
