import { parseCalendarDate } from '@/components/room-plan/shapes';

export type PlanGestureMode = 'move' | 'start' | 'end' | 'assign';

export type PlanGestureResult =
  | { kind: 'noop' }
  | { kind: 'early-checkout'; reservationId: string }
  | {
      kind: 'apply';
      reservationId: string;
      checkIn?: string;
      checkOut?: string;
      toRoomId?: string;
    };

function addNights(iso: string, days: number): string {
  const next = parseCalendarDate(iso);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function nightCount(checkIn: string, checkOut: string): number {
  return Math.round(
    (parseCalendarDate(checkOut).getTime() - parseCalendarDate(checkIn).getTime()) / 86400000,
  );
}

/**
 * Whole-night drag on the room plan.
 * In-house stays cannot move arrival or shorten; pulling the departure edge
 * backward is an early-checkout prompt, not a silent date change.
 * Room id is never folded into the date change — the caller relocates after.
 */
export function commitPlanGesture(input: {
  reservationId: string;
  status: string;
  mode: PlanGestureMode;
  deltaDays: number;
  fromRoomId: string | null;
  toRoomId: string | null;
  checkIn: string;
  checkOut: string;
  /** Grid day the pointer was released on. Used by assign. */
  assignCheckIn?: string | null;
}): PlanGestureResult {
  const inHouse = input.status === 'IN_HOUSE';
  const nights = Math.max(1, nightCount(input.checkIn, input.checkOut));
  let checkIn = input.checkIn;
  let checkOut = input.checkOut;

  if (input.mode === 'assign') {
    if (!input.toRoomId || !input.assignCheckIn) return { kind: 'noop' };
    checkIn = input.assignCheckIn;
    checkOut = addNights(checkIn, nights);
    return {
      kind: 'apply',
      reservationId: input.reservationId,
      checkIn,
      checkOut,
      toRoomId: input.toRoomId,
    };
  }

  if (input.mode === 'start') {
    if (inHouse || input.deltaDays === 0) return { kind: 'noop' };
    checkIn = addNights(input.checkIn, input.deltaDays);
    if (nightCount(checkIn, checkOut) < 1) checkIn = addNights(checkOut, -1);
  } else if (input.mode === 'end') {
    if (input.deltaDays === 0) return { kind: 'noop' };
    if (inHouse && input.deltaDays < 0) {
      return { kind: 'early-checkout', reservationId: input.reservationId };
    }
    checkOut = addNights(input.checkOut, input.deltaDays);
    if (nightCount(checkIn, checkOut) < 1) checkOut = addNights(checkIn, 1);
  } else if (!inHouse && input.deltaDays !== 0) {
    checkIn = addNights(input.checkIn, input.deltaDays);
    checkOut = addNights(input.checkOut, input.deltaDays);
  }

  const datesChanged = checkIn !== input.checkIn || checkOut !== input.checkOut;
  const roomChanged = Boolean(input.toRoomId && input.toRoomId !== input.fromRoomId);
  if (!datesChanged && !roomChanged) return { kind: 'noop' };
  if (input.mode !== 'move' && roomChanged && !datesChanged) return { kind: 'noop' };

  return {
    kind: 'apply',
    reservationId: input.reservationId,
    ...(datesChanged ? { checkIn, checkOut } : {}),
    ...(input.mode === 'move' && roomChanged && input.toRoomId ? { toRoomId: input.toRoomId } : {}),
  };
}
