export const EXTRA_PROCEDURE_ROUTES = ["SHOW_ON_PLAN", "HOLD_UNTIL_PAY"] as const;

export type ExtraProcedureRoute = (typeof EXTRA_PROCEDURE_ROUTES)[number];

/** Unknown or missing values follow the shipped default: the unpaid extra is on the plan. */
export function parseExtraProcedureRoute(value: string | null | undefined): ExtraProcedureRoute {
  return value === "HOLD_UNTIL_PAY" ? "HOLD_UNTIL_PAY" : "SHOW_ON_PLAN";
}

/**
 * Plan tab and the guest print may list an unpaid extra.
 * Cabin seat, nurse check-in, QR, and the resource matrix stay closed until pay or folio.
 */
export function showsUnpaidExtraOnPlan(route: string | null | undefined): boolean {
  return parseExtraProcedureRoute(route) === "SHOW_ON_PLAN";
}

/** PENDING_PAY still stores a placeholder clock. The guest sheet must not print it. */
export function printsProcedureClock(status: string): boolean {
  return status !== "PENDING_PAY";
}
