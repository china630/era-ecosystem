"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { GHOST_BUTTON_CLASS, MODAL_INPUT_CLASS } from "./design-system";
import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
} from "./paginated-list";

const PAGE_ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;

export { LIST_PAGE_SIZE_OPTIONS, DEFAULT_LIST_PAGE_SIZE };

export type ListPaginationFooterLabels = {
  rowsPerPage: string;
  pageOf: string;
  prev: string;
  next: string;
};

export type ListPaginationFooterProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  labels: ListPaginationFooterLabels;
  loading?: boolean;
  className?: string;
};

/**
 * Shared list pagination footer (Finance-aligned).
 * Pass translated `labels` from the host app (next-intl / i18next).
 */
export function ListPaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  labels,
  loading = false,
  className = "",
}: ListPaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] px-3 py-2 text-[13px] text-[#7F8C8D] ${className}`.trim()}
      >
        <span>…</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] px-3 py-2 text-[13px] text-[#34495E] ${className}`.trim()}
    >
      <label className="flex items-center gap-2">
        <span className="text-[#7F8C8D]">{labels.rowsPerPage}</span>
        <select
          className={`${MODAL_INPUT_CLASS} !mt-0 h-9 min-w-[4.5rem]`}
          value={String(pageSize)}
          onChange={(e) => {
            const n = Number(e.target.value);
            onPageSizeChange(
              LIST_PAGE_SIZE_OPTIONS.includes(n as (typeof LIST_PAGE_SIZE_OPTIONS)[number])
                ? n
                : DEFAULT_LIST_PAGE_SIZE,
            );
            onPageChange(1);
          }}
        >
          {LIST_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span className="tabular-nums text-[#7F8C8D]">
        {labels.pageOf
          .replace("{page}", String(page))
          .replace("{pages}", String(totalPages))
          .replace("{total}", String(total))}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={PAGE_ICON_BTN}
          disabled={page <= 1}
          title={labels.prev}
          aria-label={labels.prev}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={PAGE_ICON_BTN}
          disabled={page >= totalPages}
          title={labels.next}
          aria-label={labels.next}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
