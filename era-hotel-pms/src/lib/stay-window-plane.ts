import { hotelDateKey } from '@/lib/hotel-calendar';

/** One contextual plane under Nights on the reservation card (ADR D3). */
export type StayWindowPlaneKind = 'arrival' | 'departure' | 'earlyCheckout';

export function resolveStayWindowPlane(input: {
  checkIn: string;
  checkOut: string;
  status?: string | null;
  todayKey?: string;
}): StayWindowPlaneKind | null {
  if (!input.checkIn || !input.checkOut) return null;
  const ci = hotelDateKey(input.checkIn);
  const co = hotelDateKey(input.checkOut);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co)) return null;
  const today = input.todayKey ?? hotelDateKey();
  if (today === ci) return 'arrival';
  if (today === co) return 'departure';
  if (input.status === 'IN_HOUSE' && today > ci && today < co) return 'earlyCheckout';
  return null;
}
