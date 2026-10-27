export const BUFFET_MEALS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
export type BuffetMealCode = (typeof BUFFET_MEALS)[number];

export const BUFFET_STATUSES = ["DRAFT", "LOCKED", "SERVED", "CLOSED"] as const;

/** Portions after waste % (ceiling). Used by materials preview. */
export function effectiveBuffetPortions(plannedPortions: number, wastePct: number): number {
  return Math.ceil(plannedPortions * (1 + wastePct / 100));
}
