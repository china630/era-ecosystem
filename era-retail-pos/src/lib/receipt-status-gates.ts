/** Pure receipt status gates (AC-RET-POS negative paths). */

export function receiptVoidDenied(status: string): string | null {
  if (status === "PAID") return "Paid receipts must be returned, not voided";
  return null;
}

export function receiptPromoDenied(status: string): string | null {
  if (status !== "OPEN") return "Promo applies only to OPEN receipts";
  return null;
}

export function receiptLineVoidDenied(status: string): string | null {
  if (status !== "OPEN") return "Only open receipts allow line void";
  return null;
}
