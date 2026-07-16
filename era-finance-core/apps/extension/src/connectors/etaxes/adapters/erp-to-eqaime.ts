import type { InvoicePrefill } from "@erafinance/api-contracts";
import { EtaxesSelectors } from "../selectors";

function trySetBySelectors(
  doc: Document,
  selectors: string[],
  value: string,
  applied: HTMLElement[],
): void {
  for (const sel of selectors) {
    let el: HTMLInputElement | HTMLTextAreaElement | null = null;
    try {
      el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
    } catch {
      continue;
    }
    if (!el) continue;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    applied.push(el);
    return;
  }
}

/**
 * Structured stub mapping invoice line-items to expected DVX DOM fields.
 * Used when live table selectors are incomplete — RPA / pilot can fill from this plan.
 */
export type EqaimeLineItemDomPlan = {
  rowIndex: number;
  fields: {
    name: string;
    quantity: string;
    unitPrice: string;
    vatRate: string;
    lineNet: string;
    lineVat: string;
    lineGross: string;
  };
  /** Candidate selectors to try once DVX table DOM is verified. */
  candidateSelectors: {
    name: string[];
    quantity: string[];
    unitPrice: string[];
    vatRate: string[];
    lineGross: string[];
  };
};

function buildLineItemDomPlan(prefill: InvoicePrefill): EqaimeLineItemDomPlan[] {
  return prefill.items.map((item, rowIndex) => ({
    rowIndex,
    fields: {
      name: item.name,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPriceAzn),
      vatRate: String(item.vatRatePct),
      lineNet: String(item.totalNetAzn),
      lineVat: String(item.totalVatAzn),
      lineGross: String(item.totalGrossAzn),
    },
    candidateSelectors: {
      name: [
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='name']`,
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='mal']`,
        `input[name*='lines[${rowIndex}].name']`,
        `input[name*='items[${rowIndex}].name']`,
      ],
      quantity: [
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='qty']`,
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='miqdar']`,
        `input[name*='lines[${rowIndex}].quantity']`,
      ],
      unitPrice: [
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='price']`,
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='qiymet']`,
        `input[name*='lines[${rowIndex}].unitPrice']`,
      ],
      vatRate: [
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='vat']`,
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='edv']`,
        `input[name*='lines[${rowIndex}].vatRate']`,
      ],
      lineGross: [
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='total']`,
        `table tbody tr:nth-child(${rowIndex + 1}) input[name*='cemi']`,
        `input[name*='lines[${rowIndex}].total']`,
      ],
    },
  }));
}

export function mapInvoicePrefillToFields(
  prefill: InvoicePrefill,
  doc: Document,
): { applied: HTMLElement[]; lineItemPlan: EqaimeLineItemDomPlan[] } {
  const applied: HTMLElement[] = [];
  const fields = EtaxesSelectors.eqaimeFields;

  trySetBySelectors(doc, fields.counterpartyName, prefill.counterparty.name, applied);
  if (prefill.counterparty.taxId) {
    trySetBySelectors(doc, fields.counterpartyVoen, prefill.counterparty.taxId, applied);
  }
  trySetBySelectors(doc, fields.invoiceDate, prefill.issueDate.slice(0, 10), applied);
  trySetBySelectors(doc, fields.invoiceNumber, prefill.number, applied);
  trySetBySelectors(doc, fields.totalNet, String(prefill.totals.netAzn), applied);
  trySetBySelectors(doc, fields.totalVat, String(prefill.totals.vatAzn), applied);
  trySetBySelectors(doc, fields.totalGross, String(prefill.totals.grossAzn), applied);

  const lineItemPlan = buildLineItemDomPlan(prefill);

  // Attempt best-effort line fill when DVX table selectors resolve; otherwise leave plan for RPA.
  for (const plan of lineItemPlan) {
    trySetBySelectors(doc, plan.candidateSelectors.name, plan.fields.name, applied);
    trySetBySelectors(doc, plan.candidateSelectors.quantity, plan.fields.quantity, applied);
    trySetBySelectors(doc, plan.candidateSelectors.unitPrice, plan.fields.unitPrice, applied);
    trySetBySelectors(doc, plan.candidateSelectors.vatRate, plan.fields.vatRate, applied);
    trySetBySelectors(doc, plan.candidateSelectors.lineGross, plan.fields.lineGross, applied);
  }

  // TODO(DVX pilot): replace candidateSelectors with verified portal table DOM once available.
  // Until then, `lineItemPlan` is the structured stub mapping invoice items → expected fields.
  if (typeof window !== "undefined") {
    (window as unknown as { __eraEqaimeLineItemPlan?: EqaimeLineItemDomPlan[] }).__eraEqaimeLineItemPlan =
      lineItemPlan;
  }

  return { applied, lineItemPlan };
}
