import { prisma } from '@/lib/prisma';
import type { RoomStatus } from '@prisma/client';
import { roomInventoryWhere } from '@/lib/master-data/retire-policy';
import {
  axesFromLegacyStatus,
  roomWriteFromAxes,
  type RoomHkCondition,
  type RoomInventoryStatus,
} from '@/lib/room-state';
import { OccupiedHkLockedError, roomHasInHouseStay } from '@/lib/occupied-hk-lock';



export async function listRoomsMaster() {

  return prisma.room.findMany({

    orderBy: { roomNumber: 'asc' },

    include: { roomType: true },

  });

}



export async function listRoomsInInventory() {

  return prisma.room.findMany({

    where: roomInventoryWhere,

    orderBy: { roomNumber: 'asc' },

    include: { roomType: true },

  });

}



export async function listRooms() {

  return listRoomsInInventory();

}



export async function createRoom(input: {

  roomNumber: string;

  roomTypeId: string;

  floor?: number;

  description?: string;

  viewCode?: string;

  bedTypeCode?: string;

  location?: string;

  maxBed?: number;

}) {

  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });

  if (!roomType?.active) throw new Error('Room type is retired');



  return prisma.room.create({

    data: {

      roomNumber: input.roomNumber,

      roomTypeId: input.roomTypeId,

      floor: input.floor ?? 1,

      description: input.description,

      viewCode: input.viewCode,

      bedTypeCode: input.bedTypeCode,

      location: input.location,

      maxBed: input.maxBed,

      status: 'CLEAN',
      hkCondition: 'CLEAN',
      inventoryStatus: 'IN_SERVICE',

    },

    include: { roomType: true },

  });

}



export async function updateRoomMasterData(

  id: string,

  input: {

    roomTypeId?: string;

    floor?: number;

    description?: string | null;

    viewCode?: string | null;

    bedTypeCode?: string | null;

    location?: string | null;

    maxBed?: number | null;

    disabled?: boolean;

    deleted?: boolean;

  },

) {

  if (input.roomTypeId) {

    const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });

    if (!roomType) throw new Error('Room type not found');

    if (!roomType.active) throw new Error('Room type is retired');

  }

  return prisma.room.update({

    where: { id },

    data: input,

    include: { roomType: true },

  });

}



export async function assignRoomType(id: string, roomTypeId: string) {

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });

  if (!roomType) throw new Error('Room type not found');

  if (!roomType.active) throw new Error('Room type is retired');

  return prisma.room.update({

    where: { id },

    data: { roomTypeId },

    include: { roomType: true },

  });

}



export async function updateRoomStatus(id: string, status: RoomStatus) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new Error('Room not found');
  const axes = axesFromLegacyStatus(status);
  const occupied = await roomHasInHouseStay(id);
  let hk = axes.hkCondition;
  if (occupied && hk !== room.hkCondition) {
    const inventoryOnly = axes.inventoryStatus === 'OOO' || axes.inventoryStatus === 'OOS';
    if (!inventoryOnly) throw new OccupiedHkLockedError();
    hk = room.hkCondition as RoomHkCondition;
  }
  return prisma.room.update({
    where: { id },
    data: roomWriteFromAxes(hk, axes.inventoryStatus, axes.inventoryReason),
    include: { roomType: true },
  });
}

export async function updateRoomAxes(
  id: string,
  hk: RoomHkCondition,
  inventory: RoomInventoryStatus,
  reason?: string | null,
) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new Error('Room not found');
  if (hk !== room.hkCondition && (await roomHasInHouseStay(id))) {
    throw new OccupiedHkLockedError();
  }
  return prisma.room.update({
    where: { id },
    data: roomWriteFromAxes(hk, inventory, reason),
    include: { roomType: true },
  });
}

/** Take an OOS/OOO door back to sellable inventory. HK condition stays DIRTY. */
export async function returnRoomToService(id: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new Error('Room not found');
  const { todayBakuYmd } = await import('@era/satellite-kit/time');
  const end = new Date(`${todayBakuYmd()}T00:00:00.000Z`);
  const updated = await prisma.room.update({
    where: { id },
    data: roomWriteFromAxes('DIRTY', 'IN_SERVICE', null),
    include: { roomType: true },
  });
  await prisma.roomClosure.updateMany({
    where: { roomId: id, OR: [{ endDate: null }, { endDate: { gt: end } }] },
    data: { endDate: end },
  });
  return updated;
}



export async function setRoomOOO(id: string, days: number, notes?: string) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw new Error('Room not found');
  const occupied = await roomHasInHouseStay(id);
  const hk = occupied ? (existing.hkCondition as RoomHkCondition) : 'DIRTY';
  const room = await prisma.room.update({
    where: { id },
    data: roomWriteFromAxes(hk, 'OOO'),
  });
  await prisma.housekeepingTask.create({
    data: {
      roomId: id,
      status: 'PENDING',
      notes: notes ?? `OOO ${days} days`,
      jobType: 'OTHER',
    },
  });
  return room;
}

export async function setRoomOOS(id: string, days: number, notes?: string) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw new Error('Room not found');
  const occupied = await roomHasInHouseStay(id);
  const hk = occupied ? (existing.hkCondition as RoomHkCondition) : 'DIRTY';
  const room = await prisma.room.update({
    where: { id },
    data: roomWriteFromAxes(hk, 'OOS'),
  });
  await prisma.housekeepingTask.create({
    data: {
      roomId: id,
      status: 'PENDING',
      notes: notes ?? `OOS ${days} days`,
      jobType: 'OTHER',
    },
  });
  return room;
}


