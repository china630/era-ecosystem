import { prisma } from '@/lib/prisma';
import type { RoomStatus } from '@prisma/client';

export async function listRooms() {
  return prisma.room.findMany({
    orderBy: { roomNumber: 'asc' },
    include: {
      roomType: true,
      reservations: {
        where: { status: { in: ['CONFIRMED', 'IN_HOUSE'] } },
        include: { guest: true },
        take: 1,
      },
    },
  });
}

export async function createRoom(input: {
  roomNumber: string;
  roomTypeId: string;
  floor?: number;
}) {
  return prisma.room.create({
    data: {
      roomNumber: input.roomNumber,
      roomTypeId: input.roomTypeId,
      floor: input.floor ?? 1,
      status: 'AVAILABLE',
    },
    include: { roomType: true },
  });
}

export async function assignRoomType(id: string, roomTypeId: string) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  return prisma.room.update({
    where: { id },
    data: { roomTypeId },
    include: { roomType: true },
  });
}

export async function updateRoomStatus(id: string, status: RoomStatus) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new Error('Room not found');
  return prisma.room.update({
    where: { id },
    data: { status },
    include: { roomType: true },
  });
}

export async function setRoomOOO(id: string, days: number, notes?: string) {
  const room = await prisma.room.update({
    where: { id },
    data: { status: 'OOO' },
  });
  await prisma.housekeepingTask.create({
    data: { roomId: id, status: 'PENDING', notes: notes ?? `OOO ${days} days` },
  });
  return room;
}
