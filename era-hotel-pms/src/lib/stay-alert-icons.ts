import { hotelDateKey } from '@/lib/hotel-calendar';

/** Visible from two Baku days before the date through the date itself. */
export function alertDueWithinTwoDays(day: string, today: string): boolean {
  const a = Date.parse(`${day.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const gap = Math.round((a - b) / 86_400_000);
  return gap >= 0 && gap <= 2;
}

export type StayTransferHint = { direction: 'IN' | 'OUT'; pickupOn: string };

const OPEN_TRANSFER = new Set(['BOOKED', 'CONFIRMED']);

export function stayTransferHints(
  orders: Array<{ direction: string; pickupAt: Date | string; status: string }>,
  today: string,
): StayTransferHint[] {
  return orders
    .filter((order) => OPEN_TRANSFER.has(order.status))
    .map((order) => ({
      direction: order.direction === 'OUT' ? ('OUT' as const) : ('IN' as const),
      pickupOn: hotelDateKey(order.pickupAt instanceof Date ? order.pickupAt : new Date(order.pickupAt)),
    }))
    .filter((order) => alertDueWithinTwoDays(order.pickupOn, today));
}
