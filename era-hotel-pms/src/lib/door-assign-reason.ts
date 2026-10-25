import { canAssignDoor, canBookDoor, resolveAxes, type RoomHkCondition, type RoomInventoryStatus } from '@/lib/room-state';
import type { RoomStatus } from '@prisma/client';

export type DoorBlockCode = 'OOS' | 'OOO' | 'WRONG_TYPE' | 'DIRTY' | 'OCCUPIED' | 'BOOKED';

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
    /** A guest is in house on this door for the clash window. */
    occupied: boolean;
    /** A confirmed or option stay holds the door, and nobody is in house on it. */
    booked?: boolean;
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
  if (opts.booked) return { code: 'BOOKED' };
  const gate = opts.inHouse ? canAssignDoor : canBookDoor;
  if (!gate(asRoom(room), false)) return { code: 'DIRTY' };
  return null;
}

/** Desk toast for a door the server refused. Null when the body is some other error. */
export function doorConflictToast(
  body: unknown,
): { key: 'doorOccupiedToast' | 'doorBookedToast'; from: string; to: string } | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as { code?: unknown; from?: unknown; to?: unknown };
  const code = String(row.code ?? '');
  if (code !== 'DOOR_OCCUPIED' && code !== 'DOOR_BOOKED') return null;
  return {
    key: code === 'DOOR_OCCUPIED' ? 'doorOccupiedToast' : 'doorBookedToast',
    from: String(row.from ?? ''),
    to: String(row.to ?? ''),
  };
}
