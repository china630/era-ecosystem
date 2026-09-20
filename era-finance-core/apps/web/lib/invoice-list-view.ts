/** Client-side mirror of FINANCE_INVOICE_LIST schema (ADR W2). */

export const INVOICE_LIST_GRID_KEY = "FINANCE_INVOICE_LIST" as const;

export const INVOICE_LIST_COLUMN_IDS = [
  "number",
  "counterparty",
  "status",
  "dueDate",
  "totalAmount",
  "paidTotal",
  "remaining",
  "eqaimeStatus",
  "actions",
] as const;

export type InvoiceListColumnId = (typeof INVOICE_LIST_COLUMN_IDS)[number];

export const INVOICE_LIST_SORT_KEYS = [
  "createdAt",
  "dueDate",
  "number",
  "totalAmount",
  "status",
] as const;

export type InvoiceListSortKey = (typeof INVOICE_LIST_SORT_KEYS)[number];

export const INVOICE_LIST_STATUSES = [
  "DRAFT",
  "SENT",
  "PAID",
  "CANCELLED",
  "PARTIALLY_PAID",
  "LOCKED_BY_SIGNATURE",
] as const;

export type InvoiceListFilters = {
  status: string;
  counterpartyId: string;
  dueFrom: string;
  dueTo: string;
};

export const EMPTY_INVOICE_LIST_FILTERS: InvoiceListFilters = {
  status: "",
  counterpartyId: "",
  dueFrom: "",
  dueTo: "",
};

export function defaultVisibleColumns(): InvoiceListColumnId[] {
  return [...INVOICE_LIST_COLUMN_IDS];
}
