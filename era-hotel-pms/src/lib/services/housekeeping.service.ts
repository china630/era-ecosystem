import { prisma } from '@/lib/prisma';
import type { HousekeepingTaskStatus, RoomStatus } from '@prisma/client';

export async function listTasks(status?: HousekeepingTaskStatus) {
  return prisma.housekeepingTask.findMany({
    where: status ? { status } : undefined,
    include: { room: { include: { roomType: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createDirtyTasksForCheckout() {
  const dirtyRooms = await prisma.room.findMany({ where: { status: 'DIRTY' } });
  const created = [];
  for (const room of dirtyRooms) {
    const existing = await prisma.housekeepingTask.findFirst({
      where: { roomId: room.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (!existing) {
      created.push(
        await prisma.housekeepingTask.create({
          data: { roomId: room.id, status: 'PENDING', notes: 'Dirty room' },
        }),
      );
    }
  }
  return created;
}

export async function completeTask(taskId: string, roomStatus: RoomStatus = 'CLEAN') {
  const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.housekeepingTask.update({
      where: { id: taskId },
      data: { status: 'DONE' },
      include: { room: true },
    });
    await tx.room.update({ where: { id: task.roomId }, data: { status: roomStatus } });
    return updated;
  });
}

export async function markInspected(roomId: string) {
  return prisma.room.update({
    where: { id: roomId },
    data: { status: 'INSPECTED' },
  });
}
