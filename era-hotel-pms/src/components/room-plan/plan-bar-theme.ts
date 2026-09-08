import { hotelDateKey } from '@/lib/hotel-calendar';
import { normalizeShareGender } from '@/lib/share-gender';
import type { ReservationStatus, RoomStatus } from './types';

/** Blunt EW-style chevron depth in CSS pixels (bar height ~26px). */
export const CHEVRON_PX = 10;

/** Caption left padding clears the butt notch. */
export const BAR_LABEL_PAD_LEFT_PX = CHEVRON_PX + 4;

export type PlanBarDayState =
  | 'option'
  | 'reservation'
  | 'expectedArrival'
  | 'inHouse'
  | 'expectedDeparture'
  | 'checkout'
  | 'multiple';

export type PlanBarTheme = {
  fill: string;
  stroke: string;
  text: string;
  /** Tailwind-ish bg class for legend swatches (inline style preferred). */
  swatchBg: string;
  dashed: boolean;
};

/**
 * ElektraWeb-inspired palette (room-plan bars only; rack unchanged).
 * Hues are intentionally far apart so day-states read at a glance
 * (reservation lime ≠ in-house forest ≠ arrival yellow ≠ departure pink).
 */
export const PLAN_BAR_COLORS: Record<PlanBarDayState, PlanBarTheme> = {
  option: {
    fill: '#B0BEC5',
    stroke: '#78909C',
    text: '#37474F',
    swatchBg: '#B0BEC5',
    dashed: true,
  },
  reservation: {
    fill: '#8BC34A',
    stroke: '#558B2F',
    text: '#FFFFFF',
    swatchBg: '#8BC34A',
    dashed: false,
  },
  expectedArrival: {
    fill: '#FDD835',
    stroke: '#F9A825',
    text: '#37474F',
    swatchBg: '#FDD835',
    dashed: false,
  },
  inHouse: {
    fill: '#2E7D32',
    stroke: '#1B5E20',
    text: '#FFFFFF',
    swatchBg: '#2E7D32',
    dashed: false,
  },
  expectedDeparture: {
    fill: '#F06292',
    stroke: '#C2185B',
    text: '#FFFFFF',
    swatchBg: '#F06292',
    dashed: false,
  },
  checkout: {
    fill: '#FFA000',
    stroke: '#EF6C00',
    text: '#37474F',
    swatchBg: '#FFA000',
    dashed: false,
  },
  multiple: {
    fill: '#00BCD4',
    stroke: '#00838F',
    text: '#FFFFFF',
    swatchBg: '#00BCD4',
    dashed: false,
  },
};

export type HkSquareKind = 'clean' | 'dirty' | 'maintenance' | 'closed' | null;

export const HK_SQUARE_COLORS: Record<Exclude<HkSquareKind, null>, string> = {
  clean: '#81D4FA',
  dirty: '#FF9800',
  maintenance: '#F44336',
  closed: '#212121',
};

/** Arrow-frame occupancy (not HK). Fill stays day-state. */
export type PlanBarOccupancyKind = 'exclusive' | 'shareM' | 'shareF';

export const PLAN_BAR_OCCUPANCY_STROKE: Record<PlanBarOccupancyKind, string> = {
  exclusive: '#34495E',
  shareM: '#1565C0',
  shareF: '#AD1457',
};

export type PlanBarInput = {
  id: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  shareEligible?: boolean;
  shareGender?: string | null;
  adults?: number | null;
  roomId?: string | null;
};

function isEffectiveShareBar(b: PlanBarInput): boolean {
  if (!b.shareEligible) return false;
  if ((b.adults ?? 1) !== 1) return false;
  return normalizeShareGender(b.shareGender) != null;
}

export function resolvePlanBarOccupancyKind(bar: PlanBarInput): PlanBarOccupancyKind {
  if (!isEffectiveShareBar(bar)) return 'exclusive';
  return normalizeShareGender(bar.shareGender) === 'F' ? 'shareF' : 'shareM';
}

/** Doors out of sale / repair are HK + inventory, not the room plan. */
export function isPlanVisibleRoom(room: {
  status?: string | null;
  inventoryStatus?: string | null;
}): boolean {
  const status = (room.status ?? '').toUpperCase();
  const inv = (room.inventoryStatus ?? '').toUpperCase();
  if (status === 'OOO' || status === 'OOS' || status === 'MAINTENANCE') return false;
  if (inv === 'OOO' || inv === 'OOS') return false;
  return true;
}

function staysOverlapKeys(a: PlanBarInput, b: PlanBarInput): boolean {
  const aCi = hotelDateKey(a.checkInDate);
  const aCo = hotelDateKey(a.checkOutDate);
  const bCi = hotelDateKey(b.checkInDate);
  const bCo = hotelDateKey(b.checkOutDate);
  return aCi < bCo && bCi < aCo;
}

/** True when another effective share on the same door overlaps this stay. */
export function hasOverlappingShareRoommate(
  bar: PlanBarInput,
  roomBars: PlanBarInput[],
): boolean {
  if (!isEffectiveShareBar(bar) || !bar.roomId) return false;
  return roomBars.some((other) => {
    if (other.id === bar.id) return false;
    if (other.roomId !== bar.roomId) return false;
    if (!isEffectiveShareBar(other)) return false;
    return staysOverlapKeys(bar, other);
  });
}

/**
 * Day-state for paint (not raw reservation.status).
 * `todayKey` defaults to hotelDateKey() (Asia/Baku).
 */
export function resolvePlanBarDayState(
  bar: PlanBarInput,
  roomBars: PlanBarInput[] = [],
  todayKey: string = hotelDateKey(),
): PlanBarDayState {
  if (bar.status === 'OPTION') return 'option';
  if (bar.status === 'CHECKED_OUT') return 'checkout';

  if (hasOverlappingShareRoommate(bar, roomBars)) return 'multiple';

  const ci = hotelDateKey(bar.checkInDate);
  const co = hotelDateKey(bar.checkOutDate);

  if (bar.status === 'CONFIRMED') {
    // Arrival day and overdue (still not checked in) stay yellow until CI.
    return ci <= todayKey ? 'expectedArrival' : 'reservation';
  }
  if (bar.status === 'IN_HOUSE') {
    return co === todayKey ? 'expectedDeparture' : 'inHouse';
  }
  // CANCELLED / NO_SHOW should not appear on the plan feed.
  return 'reservation';
}

export function themeForDayState(state: PlanBarDayState): PlanBarTheme {
  return PLAN_BAR_COLORS[state];
}

export function resolveHkSquareKind(room: {
  status: RoomStatus;
  hkCondition?: string | null;
}): HkSquareKind {
  if (room.status === 'OOO' || room.status === 'OOS') return 'closed';
  if (room.status === 'MAINTENANCE') return 'maintenance';
  const hk = (room.hkCondition ?? '').toUpperCase();
  if (room.status === 'DIRTY' || hk === 'DIRTY' || hk === 'PICKUP') return 'dirty';
  if (hk === 'CLEAN' || hk === 'INSPECTED' || room.status === 'CLEAN' || room.status === 'INSPECTED') {
    return 'clean';
  }
  if (room.status === 'AVAILABLE' || room.status === 'OCCUPIED') return 'clean';
  return null;
}
