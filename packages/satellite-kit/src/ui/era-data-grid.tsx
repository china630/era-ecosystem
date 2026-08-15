"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SCROLL_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "./design-system";
import type { EraDataGridProps } from "./era-ops-types";
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPaginationFooter,
  type ListPaginationFooterLabels,
} from "./list-pagination-footer";

const DEFAULT_PAGINATION_LABELS: ListPaginationFooterLabels = {
  rowsPerPage: "Rows per page",
  pageOf: "Page {page} of {pages} ({total})",
  prev: "Previous",
  next: "Next",
};

/**
 * Master-data / list grid — DESIGN.md table chrome + ListPaginationFooter.
 * Sticky header is clipped by DATA_TABLE_SHELL_CLASS (overflow-hidden + rounded-2xl).
 */
export function EraDataGrid<T extends Record<string, unknown>>({
  title,
  columns,
  rows,
  rowKey,
  onAdd,
  addLabel = "Add",
  emptyMessage = "No rows yet.",
  toolbar,
  pagination = true,
  paginationLabels,
  defaultPageSize = DEFAULT_LIST_PAGE_SIZE,
}: EraDataGridProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  // Keep page in range; jump to 1 when the dataset size or page size changes (filters / rows-per-page).
  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    if (!pagination) return rows;
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pagination, rows, page, pageSize]);

  const labels = paginationLabels ?? DEFAULT_PAGINATION_LABELS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <h2 className="text-[15px] font-semibold text-[#34495E]">{title}</h2> : null}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {onAdd ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAdd}>
              {addLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={DATA_TABLE_SHELL_CLASS}>
        <div className={DATA_TABLE_SCROLL_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                {columns.map((col) => (
                  <th key={col.key} className={`${DATA_TABLE_TH_LEFT_CLASS} ${col.className ?? ""}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                    colSpan={columns.length}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={rowKey(row)} className={DATA_TABLE_TR_CLASS}>
                    {columns.map((col) => (
                      <td key={col.key} className={`${DATA_TABLE_TD_CLASS} ${col.className ?? ""}`}>
                        {col.render ? col.render(row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination ? (
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={labels}
          />
        ) : null}
      </div>
    </div>
  );
}
