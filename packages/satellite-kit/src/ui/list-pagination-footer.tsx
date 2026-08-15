"use client";

import { MODAL_INPUT_CLASS, SECONDARY_BUTTON_CLASS } from "./design-system";

export const LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_LIST_PAGE_SIZE = 25;

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

  if (loading) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] px-3 py-3 text-[13px] text-[#34495E] ${className}`.trim()}
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
          className={SECONDARY_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {labels.prev}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {labels.next}
        </button>
      </div>
    </div>
  );
}