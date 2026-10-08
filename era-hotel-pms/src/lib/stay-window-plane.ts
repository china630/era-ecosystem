import { hotelDateKey } from '@/lib/hotel-calendar';

/** One plane under Nights. It runs the same stay action as the footer button. */
export type StayWindowPlaneKind = 'earlyArrival' | 'arrival' | 'earlyCheckout' | 'departure';

export type StayActionKind = 'earlyCheckIn' | 'checkIn' | 'earlyCheckOut' | 'checkOut';

function dayKey(value: string): string {
  const key = hotelDateKey(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
}

/** Calendar days from earlier to later. Both keys are YYYY-MM-DD. */
export function hotelStayDayGap(later: string, earlier: string): number {
  const a = Date.parse(`${later}T12:00:00Z`);
  const b = Date.parse(`${earlier}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((a - b) / 86_400_000));
}

export function resolveStayWindowPlane(input: {
  checkIn: string;
  checkOut: string;
  status?: string | null;
  todayKey?: string;
}): StayWindowPlaneKind | null {
  const ci = dayKey(input.checkIn);
  const co = dayKey(input.checkOut);
  if (!ci || !co) return null;
  const today = input.todayKey ?? hotelDateKey();
  const status = input.status ?? '';
  if (status === 'CHECKED_OUT' || status === 'CANCELLED' || status === 'NO_SHOW') return null;
  if (status === 'IN_HOUSE') {
    return today < co ? 'earlyCheckout' : 'departure';
  }
  if (status === 'CONFIRMED' || status === 'OPTION' || status === '') {
    return today < ci ? 'earlyArrival' : 'arrival';
  }
  return null;
}

export function stayActionForPlane(kind: StayWindowPlaneKind | null): StayActionKind | null {
  if (kind === 'earlyArrival') return 'earlyCheckIn';
  if (kind === 'arrival') return 'checkIn';
  if (kind === 'earlyCheckout') return 'earlyCheckOut';
  if (kind === 'departure') return 'checkOut';
  return null;
}
