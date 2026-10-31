/**
 * Paid diagnostic visits stay off clinical work until settledAt is set
 * (sibling of lab-order-pay-gate).
 */

export function isVisitAwaitingPayment(visit: {
  amountNet: unknown;
  settledAt: Date | null;
}): boolean {
  return Number(visit.amountNet) > 0 && !visit.settledAt;
}

export const VISIT_AWAITING_PAYMENT = "VISIT_AWAITING_PAYMENT";

export function assertVisitReadyForWork(visit: {
  amountNet: unknown;
  settledAt: Date | null;
}): void {
  if (!isVisitAwaitingPayment(visit)) return;
  const err = new Error("Visit awaits payment");
  (err as Error & { code?: string }).code = VISIT_AWAITING_PAYMENT;
  throw err;
}

/** HTTP shape for visit routes that must refuse unpaid priced visits. */
export function visitAwaitingPaymentDenied(visit: {
  amountNet: unknown;
  settledAt: Date | null;
}): { message: string; status: 409; code: typeof VISIT_AWAITING_PAYMENT } | null {
  if (!isVisitAwaitingPayment(visit)) return null;
  return {
    message: "Visit awaits payment",
    status: 409,
    code: VISIT_AWAITING_PAYMENT,
  };
}
