export const EXTRA_PROCEDURE_ROUTES = ["PLAN_BEFORE_PAY", "HOLD_UNTIL_PAY"] as const;

export type ExtraProcedureRoute = (typeof EXTRA_PROCEDURE_ROUTES)[number];

/**
 * SHOW_ON_PLAN is the old name of plan-before-pay. Unknown values follow the
 * Nafta default: seat the unpaid extra, do not hide it until the cashier.
 */
export function parseExtraProcedureRoute(value: string | null | undefined): ExtraProcedureRoute {
  return value === "HOLD_UNTIL_PAY" ? "HOLD_UNTIL_PAY" : "PLAN_BEFORE_PAY";
}

/** Planner seats each unpaid extra on its own day and cabin before payment. */
export function plansExtraBeforePay(route: string | null | undefined): boolean {
  return parseExtraProcedureRoute(route) !== "HOLD_UNTIL_PAY";
}

/** Plan tab and the guest print list an unpaid extra. */
export function showsUnpaidExtraOnPlan(route: string | null | undefined): boolean {
  return plansExtraBeforePay(route);
}

/**
 * A seated unpaid extra prints its real clock. A hold-until-pay row has no cabin
 * and must not print the placeholder time.
 */
export function printsProcedureClock(
  status: string,
  resourceId?: string | null,
): boolean {
  if (status !== "PENDING_PAY") return true;
  return Boolean(resourceId);
}
