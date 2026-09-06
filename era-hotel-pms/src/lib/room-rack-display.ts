import { hotelDateKey, stayTouchesHotelDateRange } from '@/lib/hotel-calendar';
import { normalizeShareGender } from '@/lib/share-gender';
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
}): { text: string; className: string; gender: 'M' | 'F' | null } {
  const gender = normalizeShareGender(pool.gender);
  const isMale = gender === 'M';
  const sym = gender === 'F' ? '♀' : gender === 'M' ? '♂' : '·';
  return {
    gender,
    text: `${sym} ${pool.occupied}/${pool.capacity}`,
    className: isMale
      ? 'bg-sky-100 text-sky-800'
      : gender === 'F'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-[#EBEDF0] text-[#7F8C8D]',
  };
}

export type RackStaySlice = {
  status: ReservationStatus;
  checkInDate?: string;
  checkOutDate?: string;
  shareEligible?: boolean;
  shareGender?: string | null;
  adults?: number;
};

export function reservationsTouchingDate<T extends RackStaySlice>(
  reservations: T[],
  fromKey: string,
  toKey: string = fromKey,
): T[] {
  return reservations.filter(
    (r) =>
      Boolean(r.checkInDate) &&
      Boolean(r.checkOutDate) &&
      stayTouchesHotelDateRange(r.checkInDate!, r.checkOutDate!, fromKey, toKey),
  );
}

/** Stay shown on the door tile for the filter interval. */
export function pickRackStayForDate<T extends RackStaySlice>(
  reservations: T[],
  fromKey: string,
  toKey: string = fromKey,
): T | undefined {
  const touching = reservationsTouchingDate(reservations, fromKey, toKey);
  return (
    touching.find((r) => r.status === 'IN_HOUSE') ??
    touching.find((r) => r.status === 'CONFIRMED') ??
    touching[0]
  );
}

export function deriveSharePoolForDate(
  room: {
    maxBed?: number | null;
    roomType?: { adultCapacity?: number };
    reservations: RackStaySlice[];
  },
  fromKey: string,
  toKey: string = fromKey,
): { gender: string; occupied: number; capacity: number } | null {
  const touching = reservationsTouchingDate(room.reservations, fromKey, toKey);
  const shareStays = touching.filter(
    (r) =>
      r.shareEligible &&
      (r.adults ?? 1) === 1 &&
      normalizeShareGender(r.shareGender) != null,
  );
  if (shareStays.length === 0) return null;
  const gender =
    normalizeShareGender(shareStays.find((r) => r.status === 'IN_HOUSE')?.shareGender) ??
    normalizeShareGender(shareStays[0]!.shareGender);
  if (!gender) return null;
  const capacity = room.maxBed ?? room.roomType?.adultCapacity ?? 2;
  return { gender, occupied: shareStays.length, capacity };
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
  today: Date | string = new Date(),
  until: Date | string = today,
): RackDisplayState {
  if (isHkNotReady(room) || ['OOO', 'OOS', 'MAINTENANCE'].includes(room.status)) return 'notReady';
  if (isHkDirtyish(room) || room.status === 'DIRTY') return 'cleaning';

  const fromKey = hotelDateKey(today);
  const toKey = hotelDateKey(until);
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;
  const active = pickRackStayForDate(room.reservations, lo, hi);

  if (active?.checkInDate && active?.checkOutDate) {
    const ci = hotelDateKey(active.checkInDate);
    const co = hotelDateKey(active.checkOutDate);
    if (active.status === 'CONFIRMED' && ci >= lo && ci <= hi) return 'arrival';
    if (active.status === 'IN_HOUSE' && co >= lo && co <= hi) return 'departure';
    if (active.status === 'IN_HOUSE' || active.status === 'CONFIRMED' || active.status === 'OPTION') {
      return 'occupied';
    }
  }

  if (room.status === 'OCCUPIED') return 'occupied';
  return 'vacant';
}
