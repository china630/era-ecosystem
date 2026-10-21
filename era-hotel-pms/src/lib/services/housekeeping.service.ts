import { prisma } from '@/lib/prisma';
import type { HousekeepingTaskStatus, RoomHkCondition } from '@prisma/client';
import { roomWriteFromAxes } from '@/lib/room-state';
import { OccupiedHkLockedError } from '@/lib/occupied-hk-lock';
import { roomHasInHouseStay } from '@/lib/occupied-hk-guard';

export async function listTasks(status?: HousekeepingTaskStatus) {
  return prisma.housekeepingTask.findMany({
    where: status ? { status } : undefined,
    include: { room: { include: { roomType: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createDirtyTasksForCheckout() {
  const dirtyRooms = await prisma.room.findMany({
    where: { OR: [{ status: 'DIRTY' }, { hkCondition: 'DIRTY' }] },
  });
  const created = [];
  for (const room of dirtyRooms) {
    const existing = await prisma.housekeepingTask.findFirst({
      where: { roomId: room.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (!existing) {
      created.push(
        await prisma.housekeepingTask.create({
          data: {
            roomId: room.id,
            status: 'PENDING',
            notes: 'Dirty room',
            jobType: 'OTHER',
          },
        }),
      );
    }
  }
  return created;
}

export async function completeTask(
  taskId: string,
  roomStatus: RoomHkCondition | 'CLEAN' | 'INSPECTED' = 'CLEAN',
  audit?: { userId?: string | null; request?: Request },
) {
  const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  const hk: RoomHkCondition =
    roomStatus === 'INSPECTED' ? 'INSPECTED' : roomStatus === 'PICKUP' ? 'PICKUP' : 'CLEAN';

  const captured: Array<{
    id: string;
    roomNumber: string;
    status: string;
    hkCondition: string;
    inventoryStatus: string;
  }> = [];
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.housekeepingTask.update({
      where: { id: taskId },
      data: { status: 'DONE' },
      include: { room: true },
    });
    const room = await tx.room.findUnique({ where: { id: task.roomId } });
    if (room) captured.push(room);
    const inventory = room?.inventoryStatus === 'OOO' || room?.inventoryStatus === 'OOS'
      ? room.inventoryStatus
      : 'IN_SERVICE';
    await tx.room.update({
      where: { id: task.roomId },
      data: roomWriteFromAxes(hk, inventory, room?.inventoryReason),
    });
    return row;
  });
  const prior = captured[0];
  if (prior) {
    const { finishRoomStatusChange } = await import('@/lib/services/room.service');
    const inventory =
      prior.inventoryStatus === 'OOO' || prior.inventoryStatus === 'OOS'
        ? prior.inventoryStatus
        : 'IN_SERVICE';
    await finishRoomStatusChange(
      prior,
      { status: hk === 'INSPECTED' ? 'INSPECTED' : hk === 'PICKUP' ? 'PICKUP' : 'CLEAN', hkCondition: hk, inventoryStatus: inventory },
      audit,
    ).catch((error) => console.error('room status follow-up', error));
  }
  return updated;
}

export async function markInspected(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');
  if (room.hkCondition !== 'INSPECTED' && (await roomHasInHouseStay(roomId))) {
    throw new OccupiedHkLockedError();
  }
  const inventory =
    room.inventoryStatus === 'OOO' || room.inventoryStatus === 'OOS'
      ? room.inventoryStatus
      : 'IN_SERVICE';
  return prisma.room.update({
    where: { id: roomId },
    data: roomWriteFromAxes('INSPECTED', inventory, room.inventoryReason),
  }).then(async (updated) => {
    const { finishRoomStatusChange } = await import('@/lib/services/room.service');
    await finishRoomStatusChange(room, updated).catch((error) => console.error('room status follow-up', error));
    return updated;
  });
}
