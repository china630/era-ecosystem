/** Client-side mirror of invoice-vat-split.util for credit-adjust preview. */

export type CreditAdjustVatPreview = {
  gross: number;
  net: number;
  vat: number;
  receivable: number;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function computeInvoiceVatTotalsFromItems(
  items: Array<{ lineTotal: unknown; vatRate: unknown }>,
  orgIsVatPayer: boolean,
): { grossTotal: number; netTotal: number; vatTotal: number } {
  let netTotal = 0;
  let vatTotal = 0;
  for (const item of items) {
    const gross = Number(item.lineTotal);
    const vr = Number(item.vatRate);
    const pct = vr === -1 ? 0 : vr;
    if (orgIsVatPayer && pct > 0) {
      const div = 1 + pct / 100;
      const net = gross / div;
      netTotal += net;
      vatTotal += gross - net;
    } else {
      netTotal += gross;
    }
  }
  return { grossTotal: netTotal + vatTotal, netTotal, vatTotal };
}

export function previewCreditAdjustVat(
  adjustmentGross: number,
  invoiceGross: number,
  invoiceVatTotal: number,
  orgIsVatPayer: boolean,
): CreditAdjustVatPreview | null {
  if (!orgIsVatPayer || invoiceVatTotal <= 0 || invoiceGross <= 0) {
    return {
      gross: adjustmentGross,
      net: adjustmentGross,
      vat: 0,
      receivable: adjustmentGross,
    };
  }
  const ratio = adjustmentGross / invoiceGross;
  const vat = round4(invoiceVatTotal * ratio);
  const net = round4(adjustmentGross - vat);
  return {
    gross: adjustmentGross,
    net,
    vat,
    receivable: adjustmentGross,
  };
}
