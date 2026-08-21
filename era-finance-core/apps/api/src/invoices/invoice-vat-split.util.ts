import { Prisma } from "@erafinance/database";

const Decimal = Prisma.Decimal;

export type InvoiceVatTotals = {
  grossTotal: Prisma.Decimal;
  netTotal: Prisma.Decimal;
  vatTotal: Prisma.Decimal;
};

/** Sum net/VAT from invoice lines (same rules as SENT revenue recognition). */
export function computeInvoiceVatTotals(
  items: Array<{ lineTotal: Prisma.Decimal; vatRate: Prisma.Decimal }>,
  orgIsVatPayer: boolean,
): InvoiceVatTotals {
  let netTotal = new Decimal(0);
  let vatTotal = new Decimal(0);
  for (const item of items) {
    const gross = new Decimal(item.lineTotal);
    const vr = new Decimal(item.vatRate).toNumber();
    const pct = vr === -1 ? 0 : vr;
    if (orgIsVatPayer && pct > 0) {
      const div = new Decimal(1).add(new Decimal(pct).div(100));
      const net = gross.div(div);
      netTotal = netTotal.add(net);
      vatTotal = vatTotal.add(gross.sub(net));
    } else {
      netTotal = netTotal.add(gross);
    }
  }
  return {
    grossTotal: netTotal.add(vatTotal),
    netTotal,
    vatTotal,
  };
}

/**
 * Proportional net/VAT split for a credit-adjustment gross amount.
 * Mirrors SENT recognition ratio on the invoice.
 */
export function splitCreditAdjustmentVat(
  adjustmentGross: Prisma.Decimal,
  invoiceGross: Prisma.Decimal,
  invoiceVatTotal: Prisma.Decimal,
): { net: Prisma.Decimal; vat: Prisma.Decimal } {
  if (invoiceGross.lte(0) || invoiceVatTotal.lte(0)) {
    return { net: adjustmentGross, vat: new Decimal(0) };
  }
  const ratio = adjustmentGross.div(invoiceGross);
  const vat = roundMoney4(invoiceVatTotal.mul(ratio));
  const net = roundMoney4(adjustmentGross.sub(vat));
  return { net, vat };
}

function roundMoney4(v: Prisma.Decimal): Prisma.Decimal {
  return v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}
