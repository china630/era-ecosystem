/**
 * Master-data retire policy — no hard delete on referenced dictionaries.
 * @see docs/adr/hotel-master-data-retire-policy.md
 */

export type RetireFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export type RoomInventoryFilter = 'ALL' | 'INVENTORY' | 'DISABLED' | 'DELETED';

/** Prisma where: rooms available for rack / new assignment. */
export const roomInventoryWhere = {
  deleted: false,
  disabled: false,
} as const;

export function matchesRetireFilter(row: { active?: boolean }, filter: RetireFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return row.active !== false;
  if (filter === 'INACTIVE') return row.active === false;
  return true;
}

export function matchesRoomInventoryFilter(
  row: { deleted?: boolean; disabled?: boolean },
  filter: RoomInventoryFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'DELETED') return row.deleted === true;
  if (filter === 'DISABLED') return row.disabled === true && row.deleted !== true;
  if (filter === 'INVENTORY') return row.deleted !== true && row.disabled !== true;
  return true;
}

export function assertActiveForNewUse(entity: string, active: boolean | undefined): void {
  if (active === false) {
    throw new Error(`${entity} is retired and cannot be used for new operations`);
  }
}

export function assertRoomInventoryAvailable(room: {
  roomNumber: string;
  deleted: boolean;
  disabled: boolean;
}): void {
  if (room.deleted) {
    throw new Error(`Room ${room.roomNumber} is deleted from inventory`);
  }
  if (room.disabled) {
    throw new Error(`Room ${room.roomNumber} is disabled`);
  }
}
