/**
 * Whitelist schema for FINANCE_INVOICE_LIST saved views (ADR W2).
 * Typed columns only — no JSONB extraAttributes filters.
 */

import {
  SAVED_LIST_VIEW_GRID_FINANCE_INVOICE,
  type SavedListViewSchema,
} from "@era/satellite-kit";

export const INVOICE_LIST_GRID_KEY = SAVED_LIST_VIEW_GRID_FINANCE_INVOICE;

export const INVOICE_LIST_COLUMNS = [
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

export const INVOICE_LIST_FILTERS = [
  "status",
  "counterpartyId",
  "dueFrom",
  "dueTo",
] as const;

export const INVOICE_LIST_SORT_KEYS = [
  "createdAt",
  "dueDate",
  "number",
  "totalAmount",
  "status",
] as const;

export const INVOICE_LIST_STATUSES = [
  "DRAFT",
  "SENT",
  "PAID",
  "CANCELLED",
  "PARTIALLY_PAID",
  "LOCKED_BY_SIGNATURE",
] as const;

export const INVOICE_LIST_VIEW_SCHEMA: SavedListViewSchema = {
  gridKey: INVOICE_LIST_GRID_KEY,
  columns: INVOICE_LIST_COLUMNS,
  requiredColumns: ["actions"],
  filters: INVOICE_LIST_FILTERS,
  sortKeys: INVOICE_LIST_SORT_KEYS,
  defaultSort: { key: "createdAt", dir: "desc" },
};

export type InvoiceListSortKey = (typeof INVOICE_LIST_SORT_KEYS)[number];
