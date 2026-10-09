/**
 * A plan is quoted from the BAR calendar only when it is the BASE plan,
 * or a derivation that points at a parent and has an adjustment.
 * Elektra rate codes are stored as DERIVED with no parent: they keep their own price.
 */
export function usesBarCalendar(plan: {
  type: string;
  derivedFromId?: string | null;
  adjustmentMode?: string | null;
  adjustmentValue?: unknown;
}): boolean {
  if (plan.type === 'BASE') return true;
  if (plan.type !== 'DERIVED') return false;
  return Boolean(plan.derivedFromId && plan.adjustmentMode && plan.adjustmentValue != null);
}

/** Night audit names this stay and continues. The business date still rolls. */
export class NightlyPriceMissingError extends Error {
  readonly code = 'NIGHTLY_PRICE_MISSING';

  constructor(
    readonly reservationId: string,
    readonly ratePlanCode: string,
  ) {
    super(
      `Nightly price missing for reservation ${reservationId} (rate ${ratePlanCode})`,
    );
    this.name = 'NightlyPriceMissingError';
  }
}
