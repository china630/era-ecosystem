import { canAssignDoor, canBookDoor, resolveAxes, type RoomHkCondition, type RoomInventoryStatus } from '@/lib/room-state';
import type { RoomStatus } from '@prisma/client';

export type DoorBlockCode = 'OOS' | 'OOO' | 'WRONG_TYPE' | 'DIRTY' | 'OCCUPIED';

export type DoorLike = {
  id: string;
  roomNumber: string;
  roomTypeId?: string | null;
  roomTypeCode?: string | null;
  status?: string | null;
  hkCondition?: string | null;
  inventoryStatus?: string | null;
};

export type DoorBlock = {
  code: DoorBlockCode;
  doorType?: string;
  needType?: string;
};

function asRoom(room: DoorLike) {
  return {
    status: (room.status ?? 'AVAILABLE') as RoomStatus,
    hkCondition: room.hkCondition as RoomHkCondition | undefined,
    inventoryStatus: room.inventoryStatus as RoomInventoryStatus | undefined,
  };
}

/** Why this door cannot be assigned. Null = the desk may pick it. */
export function doorAssignBlock(
  room: DoorLike,
  opts: {
    needTypeId?: string | null;
    needTypeCode?: string | null;
    inHouse: boolean;
    occupied: boolean;
    currentAssignedId?: string | null;
  },
): DoorBlock | null {
  if (opts.currentAssignedId && room.id === opts.currentAssignedId) return null;
  const needTypeId = opts.needTypeId?.trim();
  if (needTypeId && room.roomTypeId && room.roomTypeId !== needTypeId) {
    return {
      code: 'WRONG_TYPE',
      doorType: room.roomTypeCode?.trim() || '—',
      needType: opts.needTypeCode?.trim() || '—',
    };
  }
  const axes = resolveAxes(asRoom(room));
  if (axes.inventoryStatus === 'OOS') return { code: 'OOS' };
  if (axes.inventoryStatus === 'OOO') return { code: 'OOO' };
  if (opts.occupied) return { code: 'OCCUPIED' };
  const gate = opts.inHouse ? canAssignDoor : canBookDoor;
  if (!gate(asRoom(room), false)) return { code: 'DIRTY' };
  return null;
}
