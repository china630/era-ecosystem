import { recalcReceiptTotals } from "@/lib/receipt-promo";
import type { Receipt, ReceiptLine } from "@prisma/client";

export function activeLineTotals(lines: ReceiptLine[]): number[] {
  return lines
    .filter((l) => l.lineStatus === "ACTIVE")
    .map((l) => Number(l.lineTotal));
}

export function totalsFromReceipt(receipt: Pick<Receipt, "discountPercent" | "discountAmount">, lines: ReceiptLine[]) {
  return recalcReceiptTotals(activeLineTotals(lines), {
    discountPercent: receipt.discountPercent != null ? Number(receipt.discountPercent) : null,
    discountAmount: Number(receipt.discountAmount ?? 0),
  });
}
