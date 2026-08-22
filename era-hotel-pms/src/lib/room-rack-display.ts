import {
  canAssignDoor,
  isHkDirtyish,
  isHkNotReady,
  type RoomHkCondition,
  type RoomInventoryStatus,
} from '@/lib/room-state';

type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type RackDisplayState =
  | 'vacant'
  | 'occupied'
  | 'arrival'
  | 'departure'
  | 'cleaning'
  | 'notReady';

export const RACK_SWATCH_CLASS: Record<RackDisplayState, string> = {
  vacant: 'bg-emerald-500',
  occupied: 'bg-[#2980B9]',
  arrival: 'bg-amber-500',
  departure: 'bg-violet-500',
  cleaning: 'bg-orange-500',
  notReady: 'bg-red-500',
};

export const RACK_BORDER_CLASS: Record<RackDisplayState, string> = {
  vacant: 'border-t-4 border-t-emerald-500',
  occupied: 'border-t-4 border-t-[#2980B9]',
  arrival: 'border-t-4 border-t-amber-500',
  departure: 'border-t-4 border-t-violet-500',
  cleaning: 'border-t-4 border-t-orange-500',
  notReady: 'border-t-4 border-t-red-500',
};

/** Text color for room number / status label on rack cards */
export const RACK_TEXT_CLASS: Record<RackDisplayState, string> = {
  vacant: 'text-emerald-600',
  occupied: 'text-[#2980B9]',
  arrival: 'text-amber-600',
  departure: 'text-violet-600',
  cleaning: 'text-orange-600',
  notReady: 'text-red-600',
};

/** Room number color when HK status drives display (Wave G) */
export const RACK_NUMBER_BY_HK: Record<RoomStatus, string> = {
  AVAILABLE: 'text-[#2980B9]',
  CLEAN: 'text-emerald-600',
  INSPECTED: 'text-emerald-500',
  DIRTY: 'text-orange-600',
  OCCUPIED: 'text-amber-600',
  OOO: 'text-red-700',
  OOS: 'text-red-700',
  MAINTENANCE: 'text-red-700',
};

export function rackNumberTextClass(
  room: {
    status: RoomStatus;
    hkCondition?: RoomHkCondition;
    rackDisplayState?: RackDisplayState;
  },
): string {
  if (room.rackDisplayState) return RACK_TEXT_CLASS[room.rackDisplayState];
  if (room.hkCondition === 'PICKUP') return 'text-amber-500';
  return RACK_NUMBER_BY_HK[room.status] ?? 'text-[#34495E]';
}

export function formatSharePoolBadge(pool: {
  gender: string;
  occupied: number;
  capacity: number;
}): { text: string; className: string } {
  const isMale = pool.gender.toUpperCase().startsWith('M');
  const sym = isMale ? '♂' : '♀';
  return {
    text: `${sym} ${pool.occupied}/${pool.capacity}`,
    className: isMale ? 'text-sky-700' : 'text-rose-700',
  };
}

export function canQuickBookRoom(room: {
  status: RoomStatus;
  hkCondition?: RoomHkCondition | null;
  inventoryStatus?: RoomInventoryStatus | null;
  rackDisplayState?: RackDisplayState;
}): boolean {
  const state = room.rackDisplayState ?? 'vacant';
  if (state !== 'vacant') return false;
  return canAssignDoor(room, false);
}

function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function computeRackDisplayState(
  room: {
    status: RoomStatus;
    hkCondition?: RoomHkCondition | null;
    inventoryStatus?: RoomInventoryStatus | null;
    reservations: Array<{
      status: ReservationStatus;
      checkInDate?: string;
      checkOutDate?: string;
    }>;
  },
  today = new Date(),
): RackDisplayState {
  if (isHkNotReady(room) || ['OOO', 'OOS', 'MAINTENANCE'].includes(room.status)) return 'notReady';
  if (isHkDirtyish(room) || room.status === 'DIRTY') return 'cleaning';

  const t = dayStart(today);
  const active =
    room.reservations.find((r) => r.status === 'IN_HOUSE') ?? room.reservations[0];

  if (active?.checkInDate && active?.checkOutDate) {
    const ci = dayStart(new Date(active.checkInDate));
    const co = dayStart(new Date(active.checkOutDate));
    if (active.status === 'CONFIRMED' && ci === t) return 'arrival';
    if (active.status === 'IN_HOUSE' && co === t) return 'departure';
  }

  if (room.status === 'OCCUPIED' || active?.status === 'IN_HOUSE') return 'occupied';
  return 'vacant';
}
