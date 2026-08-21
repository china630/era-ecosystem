import { InvoiceStatus, Prisma } from "@erafinance/database";

const Decimal = Prisma.Decimal;

/** Shared invoice status derivation after paidAmount changes. */
export function deriveInvoicePaymentState(
  total: Prisma.Decimal,
  paidSum: Prisma.Decimal,
  currentStatus: InvoiceStatus,
): { nextStatus: InvoiceStatus; paymentReceived: boolean } {
  if (currentStatus === InvoiceStatus.LOCKED_BY_SIGNATURE) {
    return {
      nextStatus: InvoiceStatus.LOCKED_BY_SIGNATURE,
      paymentReceived: paidSum.gte(total),
    };
  }
  if (paidSum.gte(total)) {
    return { nextStatus: InvoiceStatus.PAID, paymentReceived: true };
  }
  if (paidSum.gt(0)) {
    return {
      nextStatus: InvoiceStatus.PARTIALLY_PAID,
      paymentReceived: false,
    };
  }
  if (currentStatus === InvoiceStatus.DRAFT) {
    return { nextStatus: InvoiceStatus.DRAFT, paymentReceived: false };
  }
  return { nextStatus: InvoiceStatus.SENT, paymentReceived: false };
}

export function assertPaidAmountNonNegative(paid: Prisma.Decimal): void {
  if (paid.lt(0)) {
    throw new Error("paidAmount would become negative");
  }
}
