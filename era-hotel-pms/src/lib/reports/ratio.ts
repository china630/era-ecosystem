/** Printed wherever a ratio has no denominator (capacity 0 or not set). */
export const NO_RATIO = '—';

/** numerator / denominator, or null when the denominator is missing, zero or negative. */
export function safeRatio(numerator: number, denominator: number | null | undefined): number | null {
  if (denominator == null || !(denominator > 0) || !Number.isFinite(numerator)) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

/** Percent rounded to `digits`; null when the denominator is missing or zero. */
export function safePct(numerator: number, denominator: number | null | undefined, digits = 1): number | null {
  const ratio = safeRatio(numerator, denominator);
  if (ratio == null) return null;
  const f = 10 ** digits;
  return Math.round(ratio * 100 * f) / f;
}

/** Money-style quotient (ADR, RevPAR) rounded to `digits`; null when the denominator is missing or zero. */
export function safeDiv(numerator: number, denominator: number | null | undefined, digits = 2): number | null {
  const ratio = safeRatio(numerator, denominator);
  if (ratio == null) return null;
  const f = 10 ** digits;
  return Math.round(ratio * f) / f;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? NO_RATIO : `${value.toFixed(digits)}%`;
}
