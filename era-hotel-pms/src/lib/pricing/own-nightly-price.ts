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

/**
 * A slice tariff replaces the header only when that segment has its own price.
 * A flat zero (Medical Rates with no parent) is not the guest's tariff.
 */
export function slicePlanOverridesHeader(input: {
  samePlan: boolean;
  sliceUsesBar: boolean;
  sliceFlatPrice: number;
}): boolean {
  if (input.samePlan || input.sliceUsesBar) return false;
  return input.sliceFlatPrice > 0;
}

/** Night audit names this stay and continues. The business date still rolls. */
export class NightlyPriceMissingError extends Error {
  readonly code = 'NIGHTLY_PRICE_MISSING';

  constructor(
    readonly reservationId: string,
    readonly ratePlanCode: string,
    detail?: { packageCode?: string | null; roomTypeCode?: string | null; mealCode?: string | null },
  ) {
    const parts = [detail?.packageCode, detail?.roomTypeCode, detail?.mealCode].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    const tail = parts.length > 0 ? parts.join(' · ') : `rate ${ratePlanCode}`;
    super(`Nightly price missing for reservation ${reservationId} (${tail})`);
    this.name = 'NightlyPriceMissingError';
  }
}
