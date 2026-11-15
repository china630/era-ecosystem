/** Pure sell caps. Physical doors stay on baseQuota. Allowances default to 0. */

export type SellCapReason = 'STOP_SELL' | 'TYPE_CAP' | 'HOUSE_CAP';

export function typeSellCap(baseQuota: number, overbookAllowance: number, stopSell: boolean): number {
  if (stopSell) return 0;
  return baseQuota + Math.max(0, overbookAllowance);
}

export function houseSellCap(sumBaseQuota: number, houseOverbookAllowance: number): number {
  return sumBaseQuota + Math.max(0, houseOverbookAllowance);
}

/** Remaining doors for one type on one night, after both caps. */
export function sellableOnNight(input: {
  typeUsed: number;
  typeCap: number;
  houseUsed: number;
  houseCap: number;
  stopSell: boolean;
}): { available: number; reason: SellCapReason | null } {
  const typeLeft = input.typeCap - input.typeUsed;
  const houseLeft = input.houseCap - input.houseUsed;
  const available = Math.max(0, Math.min(typeLeft, houseLeft));
  if (available > 0) return { available, reason: null };
  if (input.stopSell) return { available: 0, reason: 'STOP_SELL' };
  if (typeLeft <= 0) return { available: 0, reason: 'TYPE_CAP' };
  return { available: 0, reason: 'HOUSE_CAP' };
}

/**
 * True oversell check for adding inventory (assign / assert).
 * Filling the last slot (used === cap) is OK; only used > cap fails.
 */
export function oversellReasonAfterAdd(input: {
  typeUsedAfter: number;
  typeCap: number;
  houseUsedAfter: number;
  houseCap: number;
  stopSell: boolean;
  delta: number;
}): SellCapReason | null {
  if (input.delta <= 0) return null;
  if (input.stopSell) return 'STOP_SELL';
  if (input.typeUsedAfter > input.typeCap) return 'TYPE_CAP';
  if (input.houseUsedAfter > input.houseCap) return 'HOUSE_CAP';
  return null;
}

const REASON_RANK: Record<SellCapReason, number> = {
  STOP_SELL: 0,
  TYPE_CAP: 1,
  HOUSE_CAP: 2,
};

/** Worst night: smallest remainder, then stop-sell before type before house. */
export function worstNight<T extends { available: number; reason: SellCapReason | null }>(nights: T[]): T | null {
  if (nights.length === 0) return null;
  return nights.reduce((best, night) => {
    if (night.available < best.available) return night;
    if (night.available > best.available) return best;
    if (night.reason && best.reason && REASON_RANK[night.reason] < REASON_RANK[best.reason]) return night;
    if (night.reason && !best.reason) return night;
    return best;
  });
}
