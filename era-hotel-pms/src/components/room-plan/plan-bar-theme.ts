import { hotelDateKey } from '@/lib/hotel-calendar';
import type { ReservationStatus, RoomStatus } from './types';

/** Blunt EW-style chevron depth in CSS pixels (bar height ~26px). */
export const CHEVRON_PX = 10;

/** Caption left padding clears the butt notch (+ optional HK square). */
export const BAR_LABEL_PAD_LEFT_PX = CHEVRON_PX + 12;

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

/** ElektraWeb-inspired palette (room-plan bars only; rack unchanged). */
export const PLAN_BAR_COLORS: Record<PlanBarDayState, PlanBarTheme> = {
  option: {
    fill: '#D5DADF',
    stroke: '#7F8C8D',
    text: '#34495E',
    swatchBg: '#D5DADF',
    dashed: true,
  },
  reservation: {
    fill: '#8BC34A',
    stroke: '#689F38',
    text: '#FFFFFF',
    swatchBg: '#8BC34A',
    dashed: false,
  },
  expectedArrival: {
    fill: '#C5E86C',
    stroke: '#9CCC65',
    text: '#34495E',
    swatchBg: '#C5E86C',
    dashed: false,
  },
  inHouse: {
    fill: '#66BB6A',
    stroke: '#43A047',
    text: '#FFFFFF',
    swatchBg: '#66BB6A',
    dashed: false,
  },
  expectedDeparture: {
    fill: '#F8BBD0',
    stroke: '#F48FB1',
    text: '#34495E',
    swatchBg: '#F8BBD0',
    dashed: false,
  },
  checkout: {
    fill: '#FFC107',
    stroke: '#FFA000',
    text: '#34495E',
    swatchBg: '#FFC107',
    dashed: false,
  },
  multiple: {
    fill: '#26C6DA',
    stroke: '#00ACC1',
    text: '#FFFFFF',
    swatchBg: '#26C6DA',
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
  const g = (b.shareGender ?? '').trim().toUpperCase();
  return g === 'M' || g === 'F' || g === 'MALE' || g === 'FEMALE' || g.startsWith('M') || g.startsWith('F');
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
    return ci === todayKey ? 'expectedArrival' : 'reservation';
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
