/**
 * Client-side band overlap guard for Forecast pack editor (Phase B).
 */

export type BandDraft = {
  code: string;
  minGuestNights: number;
  maxGuestNights: number | null;
};

/**
 * Returns true when any two bands overlap on the guest-night axis
 * (inclusive ranges; null max = open-ended).
 */
export function bandsOverlap(bands: BandDraft[]): boolean {
  const sorted = [...bands]
    .map((b) => ({
      code: b.code.trim().toUpperCase(),
      min: Math.max(0, Math.floor(Number(b.minGuestNights) || 0)),
      max:
        b.maxGuestNights == null
          ? null
          : Math.max(0, Math.floor(Number(b.maxGuestNights))),
    }))
    .filter((b) => b.code)
    .sort((a, b) => a.min - b.min);

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    if (a.max != null && a.max < a.min) return true;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      const aEnd = a.max == null ? Number.POSITIVE_INFINITY : a.max;
      const bEnd = b.max == null ? Number.POSITIVE_INFINITY : b.max;
      if (a.min <= bEnd && b.min <= aEnd) return true;
    }
  }
  return false;
}

/** True when two key SKU codes collide (case-insensitive). */
export function duplicateSkuCodes(skus: string[]): boolean {
  const seen = new Set<string>();
  for (const raw of skus) {
    const sku = raw.trim().toUpperCase();
    if (!sku) continue;
    if (seen.has(sku)) return true;
    seen.add(sku);
  }
  return false;
}
