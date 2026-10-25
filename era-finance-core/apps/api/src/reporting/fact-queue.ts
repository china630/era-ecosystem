/**
 * Month-close fact queue.
 * A manual journal never clears a row: membership ignores journal ids.
 * Open-month posting is not this gate.
 */

export const FACT_MEANINGS = [
  "CUSTOMER_PAYMENT",
  "SUPPLIER_PAYMENT",
  "FOUNDER_LOAN_IN",
  "FOUNDER_LOAN_RETURN",
  "OWNER_WITHDRAWAL",
  "BANK_COMMISSION",
  "DUPLICATE_OR_ERROR",
] as const;

export type FactMeaningCode = (typeof FACT_MEANINGS)[number];

export type FactQueueItem = {
  source: "BANK" | "CASH";
  id: string;
  date: string;
  amount: string;
  direction: "IN" | "OUT";
  label: string;
  counterpartyId: string | null;
  counterpartyRole: "CUSTOMER" | "SUPPLIER" | "BOTH" | "OTHER" | null;
  isFounder: boolean;
};

export class FactQueueNotEmptyError extends Error {
  readonly code = "FACT_QUEUE_NONEMPTY";
  constructor(readonly gaps: FactQueueItem[]) {
    super("Period stays open while a money line has no meaning");
  }
}

export function bankLineInFactQueue(line: {
  isMatched: boolean;
  factMeaning: string | null;
  manualTransactionId?: string | null;
}): boolean {
  void line.manualTransactionId;
  return line.isMatched === false && (line.factMeaning == null || line.factMeaning === "");
}

/** Posted cash only: a draft is not money in the books yet. A payment link is already a document. */
export function cashOrderInFactQueue(order: {
  status: string;
  sourceInvoiceId: string | null;
  sourceInvoicePaymentId?: string | null;
  factMeaning: string | null;
  manualTransactionId?: string | null;
}): boolean {
  void order.manualTransactionId;
  if (order.status !== "POSTED") return false;
  if (order.sourceInvoiceId || order.sourceInvoicePaymentId) return false;
  return order.factMeaning == null || order.factMeaning === "";
}

export function assertFactQueueAllowsClose(gaps: FactQueueItem[]): void {
  if (gaps.length > 0) throw new FactQueueNotEmptyError(gaps);
}

/** The queue blocks closePeriod only. Journals in an open month still post. */
export function openMonthPostingAllowed(_gaps: FactQueueItem[]): true {
  return true;
}

export function manualJournalClearsFactQueue(): false {
  return false;
}

export function counterpartyMeaningAllowed(input: {
  meaning: FactMeaningCode;
  role: FactQueueItem["counterpartyRole"];
  isFounder: boolean;
  confirmMismatch: boolean;
}): boolean {
  if (input.confirmMismatch) return true;
  if (input.meaning === "SUPPLIER_PAYMENT" && input.isFounder) return false;
  const loan =
    input.meaning === "FOUNDER_LOAN_IN" || input.meaning === "FOUNDER_LOAN_RETURN";
  if (loan && !input.isFounder && (input.role === "SUPPLIER" || input.role === "BOTH")) {
    return false;
  }
  return true;
}

export function meaningDirection(meaning: FactMeaningCode): "IN" | "OUT" | "EITHER" {
  switch (meaning) {
    case "CUSTOMER_PAYMENT":
    case "FOUNDER_LOAN_IN":
      return "IN";
    case "SUPPLIER_PAYMENT":
    case "FOUNDER_LOAN_RETURN":
    case "OWNER_WITHDRAWAL":
    case "BANK_COMMISSION":
      return "OUT";
    default:
      return "EITHER";
  }
}

/** Role postings. Customer and supplier payments only link a document. */
export function postsJournal(meaning: FactMeaningCode): boolean {
  return (
    meaning === "FOUNDER_LOAN_IN" ||
    meaning === "FOUNDER_LOAN_RETURN" ||
    meaning === "OWNER_WITHDRAWAL" ||
    meaning === "BANK_COMMISSION"
  );
}

export function offsetRole(
  meaning: FactMeaningCode,
): "FOUNDER_FUNDS" | "RETAINED_EARNINGS" | "MISC_OPERATING_EXPENSE" | null {
  switch (meaning) {
    case "FOUNDER_LOAN_IN":
    case "FOUNDER_LOAN_RETURN":
      return "FOUNDER_FUNDS";
    case "OWNER_WITHDRAWAL":
      return "RETAINED_EARNINGS";
    case "BANK_COMMISSION":
      return "MISC_OPERATING_EXPENSE";
    default:
      return null;
  }
}

export function journalLinesForMeaning(input: {
  meaning: FactMeaningCode;
  direction: "IN" | "OUT";
  moneyAccount: string;
  offsetAccount: string;
  amount: string;
}): Array<{ accountCode: string; debit: string; credit: string }> | null {
  if (!postsJournal(input.meaning)) return null;
  if (input.direction === "IN") {
    return [
      { accountCode: input.moneyAccount, debit: input.amount, credit: "0" },
      { accountCode: input.offsetAccount, debit: "0", credit: input.amount },
    ];
  }
  return [
    { accountCode: input.offsetAccount, debit: input.amount, credit: "0" },
    { accountCode: input.moneyAccount, debit: "0", credit: input.amount },
  ];
}

/** A cash order that already posted its own journal must not be posted again. */
export function shouldPostMeaningJournal(input: {
  meaning: FactMeaningCode;
  alreadyPosted: boolean;
}): boolean {
  return postsJournal(input.meaning) && !input.alreadyPosted;
}
