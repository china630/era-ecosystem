import { prisma } from '@/lib/prisma';
import type { HousekeepingTaskStatus, RoomHkCondition } from '@prisma/client';
import { roomWriteFromAxes } from '@/lib/room-state';

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

export async function completeTask(taskId: string, roomStatus: RoomHkCondition | 'CLEAN' | 'INSPECTED' = 'CLEAN') {
  const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');
  const hk: RoomHkCondition =
    roomStatus === 'INSPECTED' ? 'INSPECTED' : roomStatus === 'PICKUP' ? 'PICKUP' : 'CLEAN';

  return prisma.$transaction(async (tx) => {
    const updated = await tx.housekeepingTask.update({
      where: { id: taskId },
      data: { status: 'DONE' },
      include: { room: true },
    });
    const room = await tx.room.findUnique({ where: { id: task.roomId } });
    const inventory = room?.inventoryStatus === 'OOO' || room?.inventoryStatus === 'OOS'
      ? room.inventoryStatus
      : 'IN_SERVICE';
    await tx.room.update({
      where: { id: task.roomId },
      data: roomWriteFromAxes(hk, inventory, room?.inventoryReason),
    });
    return updated;
  });
}

export async function markInspected(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');
  const inventory =
    room.inventoryStatus === 'OOO' || room.inventoryStatus === 'OOS'
      ? room.inventoryStatus
      : 'IN_SERVICE';
  return prisma.room.update({
    where: { id: roomId },
    data: roomWriteFromAxes('INSPECTED', inventory, room.inventoryReason),
  });
}
