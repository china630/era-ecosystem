/**
 * Wave B — PDF quota knots: clamp + linear interpolate between adjacent night columns.
 */

export type QuotaKnot = {
  nights: number;
  procedureCode: string;
  qty: number;
};

export type QuotaForInput = {
  knots: QuotaKnot[];
  nights: number;
  procedureCode: string;
  minNights?: number | null;
  maxNights?: number | null;
};

export class QuotaBelowMinError extends Error {
  readonly status = 400;
  constructor(nights: number, minNights: number) {
    super(`Stay nights ${nights} below package minimum ${minNights}`);
    this.name = "QuotaBelowMinError";
  }
}

/** Distinct night columns for a procedure, sorted ascending. */
function nightColumns(
  knots: QuotaKnot[],
  procedureCode: string,
): Array<{ nights: number; qty: number }> {
  const map = new Map<number, number>();
  for (const k of knots) {
    if (k.procedureCode !== procedureCode) continue;
    map.set(k.nights, k.qty);
  }
  return [...map.entries()]
    .map(([nights, qty]) => ({ nights, qty }))
    .sort((a, b) => a.nights - b.nights);
}

/**
 * `quotaFor` — PDF knot grid with linear interpolation; clamp nights to max;
 * refuse below min (throws QuotaBelowMinError).
 */
export function quotaFor(input: QuotaForInput): number {
  const { knots, procedureCode } = input;
  let nights = Math.max(0, Math.round(input.nights));
  const minN = input.minNights ?? null;
  const maxN = input.maxNights ?? null;
  if (minN != null && nights < minN) {
    throw new QuotaBelowMinError(nights, minN);
  }
  if (maxN != null && nights > maxN) {
    nights = maxN;
  }

  const cols = nightColumns(knots, procedureCode);
  if (cols.length === 0) return 0;
  if (cols.length === 1) return cols[0].qty;

  if (nights <= cols[0].nights) return cols[0].qty;
  const last = cols[cols.length - 1];
  if (nights >= last.nights) return last.qty;

  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i];
    const b = cols[i + 1];
    if (nights === a.nights) return a.qty;
    if (nights > a.nights && nights < b.nights) {
      const t = (nights - a.nights) / (b.nights - a.nights);
      return Math.round(a.qty + t * (b.qty - a.qty));
    }
  }
  return last.qty;
}

/** Stay nights from hotel check-in / check-out (UTC date parts). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const a = Date.UTC(
    checkIn.getUTCFullYear(),
    checkIn.getUTCMonth(),
    checkIn.getUTCDate(),
  );
  const b = Date.UTC(
    checkOut.getUTCFullYear(),
    checkOut.getUTCMonth(),
    checkOut.getUTCDate(),
  );
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Recalc rule (Wave B): never decrease quotaUsed; total floors at used (remaining 0).
 */
export function applyQuotaRecalc(
  quotaUsed: number,
  newTotalFromKnots: number,
): { quotaTotal: number; remaining: number } {
  const quotaTotal = Math.max(newTotalFromKnots, quotaUsed);
  return { quotaTotal, remaining: Math.max(0, quotaTotal - quotaUsed) };
}

/**
 * Charge rule (Wave B): in-quota free; over-quota / walk-in without balance → list price.
 */
export function resolveQuotaChargeAmount(input: {
  hasProgramBalance: boolean;
  overQuota: boolean;
  walkInWithoutProgram: boolean;
  listPrice: number;
  fallbackAzn?: number;
}): number {
  const fallback = input.fallbackAzn ?? 25;
  const list = input.listPrice > 0 ? input.listPrice : fallback;
  if (input.walkInWithoutProgram) return list;
  if (input.hasProgramBalance && !input.overQuota) return 0;
  if (input.overQuota) return list;
  return list;
}
