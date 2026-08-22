import type { RoomStatus } from '@prisma/client';

export type RoomHkCondition = 'DIRTY' | 'PICKUP' | 'CLEAN' | 'INSPECTED';
export type RoomInventoryStatus = 'IN_SERVICE' | 'OOS' | 'OOO';

export type RoomAxes = {
  hkCondition: RoomHkCondition;
  inventoryStatus: RoomInventoryStatus;
  inventoryReason?: string | null;
};

const HK_ASSIGNABLE: RoomHkCondition[] = ['CLEAN', 'INSPECTED'];

export function projectLegacyStatus(
  inventory: RoomInventoryStatus,
  hk: RoomHkCondition,
): RoomStatus {
  if (inventory === 'OOO') return 'OOO';
  if (inventory === 'OOS') return 'OOS';
  if (hk === 'DIRTY') return 'DIRTY';
  if (hk === 'INSPECTED') return 'INSPECTED';
  if (hk === 'PICKUP' || hk === 'CLEAN') return 'CLEAN';
  return 'CLEAN';
}

export function axesFromLegacyStatus(status: RoomStatus): RoomAxes {
  if (status === 'OOO') {
    return { hkCondition: 'DIRTY', inventoryStatus: 'OOO' };
  }
  if (status === 'OOS') {
    return { hkCondition: 'DIRTY', inventoryStatus: 'OOS' };
  }
  if (status === 'MAINTENANCE') {
    return { hkCondition: 'DIRTY', inventoryStatus: 'OOS', inventoryReason: 'MAINTENANCE' };
  }
  if (status === 'DIRTY') {
    return { hkCondition: 'DIRTY', inventoryStatus: 'IN_SERVICE' };
  }
  if (status === 'INSPECTED') {
    return { hkCondition: 'INSPECTED', inventoryStatus: 'IN_SERVICE' };
  }
  return { hkCondition: 'CLEAN', inventoryStatus: 'IN_SERVICE' };
}

export function roomWriteFromAxes(
  hk: RoomHkCondition,
  inventory: RoomInventoryStatus,
  reason?: string | null,
): RoomAxes & { status: RoomStatus } {
  return {
    hkCondition: hk,
    inventoryStatus: inventory,
    inventoryReason: reason ?? null,
    status: projectLegacyStatus(inventory, hk),
  };
}

export function resolveAxes(room: {
  status: RoomStatus;
  hkCondition?: RoomHkCondition | null;
  inventoryStatus?: RoomInventoryStatus | null;
  inventoryReason?: string | null;
}): RoomAxes {
  if (room.hkCondition && room.inventoryStatus) {
    return {
      hkCondition: room.hkCondition,
      inventoryStatus: room.inventoryStatus,
      inventoryReason: room.inventoryReason,
    };
  }
  return axesFromLegacyStatus(room.status);
}

export function isDoorOccupiedByStays(
  reservations: Array<{ status: string }>,
): boolean {
  return reservations.some((r) => r.status === 'IN_HOUSE');
}

export function canAssignDoor(
  room: {
    status: RoomStatus;
    hkCondition?: RoomHkCondition | null;
    inventoryStatus?: RoomInventoryStatus | null;
  },
  occupied: boolean,
): boolean {
  const axes = resolveAxes(room);
  if (axes.inventoryStatus !== 'IN_SERVICE') return false;
  if (occupied) return false;
  return HK_ASSIGNABLE.includes(axes.hkCondition);
}

export function isHkNotReady(room: {
  status: RoomStatus;
  inventoryStatus?: RoomInventoryStatus | null;
  hkCondition?: RoomHkCondition | null;
}): boolean {
  const axes = resolveAxes(room);
  return axes.inventoryStatus !== 'IN_SERVICE';
}

export function isHkDirtyish(room: {
  status: RoomStatus;
  hkCondition?: RoomHkCondition | null;
  inventoryStatus?: RoomInventoryStatus | null;
}): boolean {
  const axes = resolveAxes(room);
  return axes.hkCondition === 'DIRTY' || axes.hkCondition === 'PICKUP';
}
