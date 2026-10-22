/**
 * Early checkout shortens the departure and drops nights that will not be stayed.
 * The snapshot is stored on the CHECK_OUT audit so a same-day restore can put
 * the departure, the night prices, and the door slices back.
 */

export type EarlyCheckoutRateSnap = {
  stayDate: string;
  amount: string;
  tariffAmount: string | null;
  currencyCode: string;
  fixPrice: boolean;
  discountPct: string | null;
  manualFlag: boolean;
};

export type EarlyCheckoutSliceSnap = {
  id: string;
  fromDate: string;
  toDate: string;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
  organizationId: string;
  deleted: boolean;
};

export type EarlyCheckoutRevert = {
  checkOut: string;
  totalAmount: string;
  rates: EarlyCheckoutRateSnap[];
  slices: EarlyCheckoutSliceSnap[];
};

/** Slice vs the new departure civil instant (UTC midnight of that hotel date). */
export function earlyCheckoutSliceAction(
  slice: { fromDate: Date; toDate: Date },
  endDay: Date,
): 'keep' | 'shorten' | 'delete' {
  if (slice.toDate.getTime() <= endDay.getTime()) return 'keep';
  if (slice.fromDate.getTime() >= endDay.getTime()) return 'delete';
  return 'shorten';
}

export function parseEarlyCheckoutRevert(raw: unknown): EarlyCheckoutRevert | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<EarlyCheckoutRevert>;
  if (typeof row.checkOut !== 'string' || typeof row.totalAmount !== 'string') return null;
  if (!Array.isArray(row.rates) || !Array.isArray(row.slices)) return null;
  return row as EarlyCheckoutRevert;
}
