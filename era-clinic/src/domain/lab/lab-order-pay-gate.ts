import type { Prisma } from "@prisma/client";

/** Paid unpaid labs stay off the lab journal until settledAt, except release-after-pay work. */
export function labOrderVisibleToLabWhere(): Prisma.LabOrderWhereInput {
  return {
    OR: [{ amountNet: { lte: 0 } }, { settledAt: { not: null } }, { releaseAfterPay: true }],
  };
}

/** Guest card and course print: a release-after-pay row stays hidden until it is paid or in package (amount 0). */
export function labOrderVisibleToGuestWhere(): Prisma.LabOrderWhereInput {
  return {
    OR: [{ amountNet: { lte: 0 } }, { settledAt: { not: null } }],
  };
}

export function isLabOrderAwaitingPayment(order: {
  amountNet: unknown;
  settledAt: Date | null;
}): boolean {
  return Number(order.amountNet) > 0 && !order.settledAt;
}

export const LAB_AWAITING_PAYMENT = "LAB_AWAITING_PAYMENT";

/** Collect, results, and the staff Word import stay open for release-after-pay. Pass guestBlank only for a guest-facing blank. */
export function assertLabOrderReadyForWork(order: {
  amountNet: unknown;
  settledAt: Date | null;
  releaseAfterPay?: boolean;
}): void {
  if (order.releaseAfterPay) return;
  if (!isLabOrderAwaitingPayment(order)) return;
  const err = new Error("Lab order awaits payment");
  (err as Error & { code?: string }).code = LAB_AWAITING_PAYMENT;
  throw err;
}

/** HTTP shape for lab routes that must refuse unpaid priced orders. */
export function labAwaitingPaymentDenied(order: {
  amountNet: unknown;
  settledAt: Date | null;
  releaseAfterPay?: boolean;
}, opts?: { guestBlank?: boolean }): { message: string; status: 409; code: typeof LAB_AWAITING_PAYMENT } | null {
  if (!opts?.guestBlank && order.releaseAfterPay) return null;
  if (!isLabOrderAwaitingPayment(order)) return null;
  return {
    message: "Lab order awaits payment",
    status: 409,
    code: LAB_AWAITING_PAYMENT,
  };
}
