import { Decimal } from "@erafinance/database";

export type PurchaseVatLine = {
  accountCode: string;
  debit: string;
  credit: string;
};

/**
 * Without an act or e-qaimə the whole purchase sits in expense.
 * Nothing is posted to inventory or to input VAT until the document is linked.
 */
export function purchaseVatLines(input: {
  pricesIncludeVat: boolean;
  hasTaxDocument: boolean;
  netGoods: string;
  netServices: string;
  vat: string;
  gross: string;
  inventoryCode: string;
  expenseCode: string;
  vatInputCode: string;
  payableCode: string;
}): { lines: PurchaseVatLine[]; waitingDocument: boolean; netGoods: string } {
  const vat = new Decimal(input.vat);
  const waitingDocument = input.pricesIncludeVat && vat.gt(0) && !input.hasTaxDocument;
  const lines: PurchaseVatLine[] = [];
  const netGoods = new Decimal(input.netGoods);
  const netServices = new Decimal(input.netServices);
  if (waitingDocument) {
    const expense = netGoods.add(netServices).add(vat);
    if (expense.gt(0)) {
      lines.push({ accountCode: input.expenseCode, debit: expense.toFixed(2), credit: "0.00" });
    }
  } else {
    if (netGoods.gt(0)) {
      lines.push({ accountCode: input.inventoryCode, debit: netGoods.toFixed(2), credit: "0.00" });
    }
    if (netServices.gt(0)) {
      lines.push({ accountCode: input.expenseCode, debit: netServices.toFixed(2), credit: "0.00" });
    }
    if (input.pricesIncludeVat && vat.gt(0)) {
      lines.push({ accountCode: input.vatInputCode, debit: vat.toFixed(2), credit: "0.00" });
    }
  }
  lines.push({ accountCode: input.payableCode, debit: "0.00", credit: new Decimal(input.gross).toFixed(2) });
  return { lines, waitingDocument, netGoods: waitingDocument ? netGoods.toFixed(2) : "0.00" };
}

/**
 * Move goods from expense onto inventory and the tax from expense onto 191,
 * then close 191 against output VAT. No bank or cash line.
 */
export function creditAdjustmentLines(input: {
  vat: string;
  netGoods: string;
  expenseCode: string;
  inventoryCode: string;
  vatInputCode: string;
  vatOutputCode: string;
}): PurchaseVatLine[] {
  const lines: PurchaseVatLine[] = [];
  const goods = new Decimal(input.netGoods);
  if (goods.gt(0)) {
    const amount = goods.toFixed(2);
    lines.push({ accountCode: input.inventoryCode, debit: amount, credit: "0.00" });
    lines.push({ accountCode: input.expenseCode, debit: "0.00", credit: amount });
  }
  const vat = new Decimal(input.vat);
  if (vat.gt(0)) {
    const amount = vat.toFixed(2);
    lines.push({ accountCode: input.vatInputCode, debit: amount, credit: "0.00" });
    lines.push({ accountCode: input.expenseCode, debit: "0.00", credit: amount });
    lines.push({ accountCode: input.vatOutputCode, debit: amount, credit: "0.00" });
    lines.push({ accountCode: input.vatInputCode, debit: "0.00", credit: amount });
  }
  return lines;
}

export function adjustmentMovesCash(lines: PurchaseVatLine[], cashOrBankCodes: string[]): boolean {
  const banned = new Set(cashOrBankCodes);
  return lines.some((line) => banned.has(line.accountCode));
}

/** A sale without an exemption flag keeps the scheme rate. This slice does not turn an exemption on later. */
export function salesVatPercent(input: { schemeVatPercent: string; exemptionChecked: boolean }): string {
  if (input.exemptionChecked) {
    throw new Error("This slice does not apply an exemption after the fact");
  }
  return input.schemeVatPercent;
}
