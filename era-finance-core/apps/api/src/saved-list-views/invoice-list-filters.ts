/**
 * Domain checks on top of kit normalizeSavedListView for FINANCE_INVOICE_LIST.
 */

import { BadRequestException } from "@nestjs/common";
import {
  INVOICE_LIST_STATUSES,
  type InvoiceListSortKey,
} from "./invoice-list-view.schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_SET = new Set<string>(INVOICE_LIST_STATUSES);

/**
 * Reject invalid filter *values* after kit key whitelist passes.
 * Mutates nothing — throws BadRequestException.
 */
export function assertInvoiceListFilterValues(
  filters: Record<string, string | string[]>,
): void {
  const status = filters.status;
  if (status !== undefined) {
    const s = Array.isArray(status) ? status[0] : status;
    if (s && !STATUS_SET.has(s)) {
      throw new BadRequestException({
        code: "SAVED_VIEW_UNKNOWN_KEY",
        keys: ["status"],
        message: `Unknown invoice status filter: ${s}`,
      });
    }
  }

  const cp = filters.counterpartyId;
  if (cp !== undefined) {
    const id = Array.isArray(cp) ? cp[0] : cp;
    if (id && !UUID_RE.test(id)) {
      throw new BadRequestException({
        code: "SAVED_VIEW_TYPE",
        keys: ["counterpartyId"],
        message: "counterpartyId must be a UUID",
      });
    }
  }

  const dueFrom = scalar(filters.dueFrom);
  const dueTo = scalar(filters.dueTo);
  if (dueFrom && !DATE_RE.test(dueFrom)) {
    throw new BadRequestException({
      code: "SAVED_VIEW_TYPE",
      keys: ["dueFrom"],
      message: "dueFrom must be YYYY-MM-DD",
    });
  }
  if (dueTo && !DATE_RE.test(dueTo)) {
    throw new BadRequestException({
      code: "SAVED_VIEW_TYPE",
      keys: ["dueTo"],
      message: "dueTo must be YYYY-MM-DD",
    });
  }
  if (dueFrom && dueTo && dueFrom > dueTo) {
    throw new BadRequestException({
      code: "SAVED_VIEW_TYPE",
      keys: ["dueFrom", "dueTo"],
      message: "dueFrom must be on or before dueTo",
    });
  }
}

function scalar(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function isInvoiceListSortKey(k: string): k is InvoiceListSortKey {
  return (
    k === "createdAt" ||
    k === "dueDate" ||
    k === "number" ||
    k === "totalAmount" ||
    k === "status"
  );
}
