import type { Prisma } from "@prisma/client";

/** Paid unpaid labs stay off the lab journal until settledAt is set. */
export function labOrderVisibleToLabWhere(): Prisma.LabOrderWhereInput {
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

/** Collect / results / blank refuse work until folio or cashier confirms pay. */
export function assertLabOrderReadyForWork(order: {
  amountNet: unknown;
  settledAt: Date | null;
}): void {
  if (!isLabOrderAwaitingPayment(order)) return;
  const err = new Error("Lab order awaits payment");
  (err as Error & { code?: string }).code = LAB_AWAITING_PAYMENT;
  throw err;
}

/** HTTP shape for lab routes that must refuse unpaid priced orders. */
export function labAwaitingPaymentDenied(order: {
  amountNet: unknown;
  settledAt: Date | null;
}): { message: string; status: 409; code: typeof LAB_AWAITING_PAYMENT } | null {
  if (!isLabOrderAwaitingPayment(order)) return null;
  return {
    message: "Lab order awaits payment",
    status: 409,
    code: LAB_AWAITING_PAYMENT,
  };
}
