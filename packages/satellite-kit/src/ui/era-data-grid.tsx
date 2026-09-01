"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SCROLL_CLASS,
  DATA_TABLE_SCROLL_FILL_CLASS,
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
 *
 * Defaults remain client-side slice + flow (70vh) so unrefactored screens stay unchanged.
 * Opt into paginationMode="server" + layout="fill" for EraListWorkspace lists.
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
  paginationMode = "client",
  layout = "flow",
  embedded = false,
  rowClassName,
  page: controlledPage,
  pageSize: controlledPageSize,
  total: controlledTotal,
  onPageChange,
  onPageSizeChange,
}: EraDataGridProps<T>) {
  const isServer = paginationMode === "server";

  if (
    process.env.NODE_ENV !== "production" &&
    embedded &&
    paginationMode !== "server"
  ) {
    console.warn(
      'EraDataGrid: embedded lists should set paginationMode="server" (class A / EraListWorkspace).',
    );
  }
  const [page, setPage] = useState(controlledPage ?? 1);
  const [pageSize, setPageSize] = useState(
    controlledPageSize ?? defaultPageSize,
  );

  const pageValue = isServer ? (controlledPage ?? page) : page;
  const pageSizeValue = isServer ? (controlledPageSize ?? pageSize) : pageSize;
  const total = isServer ? (controlledTotal ?? rows.length) : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSizeValue) || 1);

  // Client mode: keep page in range; jump to 1 when dataset size or page size changes.
  useEffect(() => {
    if (isServer) return;
    setPage(1);
  }, [isServer, total, pageSizeValue]);

  useEffect(() => {
    if (isServer) return;
    if (page > totalPages) setPage(totalPages);
  }, [isServer, page, totalPages]);

  const pageRows = useMemo(() => {
    if (!pagination && !isServer) return rows;
    if (isServer) return rows;
    const start = (pageValue - 1) * pageSizeValue;
    return rows.slice(start, start + pageSizeValue);
  }, [pagination, isServer, rows, pageValue, pageSizeValue]);

  const labels = paginationLabels ?? DEFAULT_PAGINATION_LABELS;
  const scrollClass =
    layout === "fill" ? DATA_TABLE_SCROLL_FILL_CLASS : DATA_TABLE_SCROLL_CLASS;
  const shellClass =
    layout === "fill"
      ? `${DATA_TABLE_SHELL_CLASS} flex min-h-0 flex-1 flex-col`
      : DATA_TABLE_SHELL_CLASS;

  function handlePageChange(next: number) {
    if (isServer) onPageChange?.(next);
    else setPage(next);
  }

  function handlePageSizeChange(next: number) {
    if (isServer) {
      onPageSizeChange?.(next);
      return;
    }
    setPageSize(next);
    setPage(1);
  }

  const showFooter = pagination && (!isServer || Boolean(onPageChange));

  const tableEl = (
    <table className={DATA_TABLE_CLASS}>
      <thead>
        <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`${DATA_TABLE_TH_LEFT_CLASS} ${col.className ?? ""}`}
            >
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
          pageRows.map((row) => {
            const tint = rowClassName?.(row);
            return (
              <tr
                key={rowKey(row)}
                className={[
                  // Drop default bg-white when a status tint is provided (Tailwind conflict).
                  tint
                    ? "border-b border-[#D5DADF] transition-colors hover:bg-[#F1F5F9]"
                    : DATA_TABLE_TR_CLASS,
                  tint,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${DATA_TABLE_TD_CLASS} ${col.className ?? ""}`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  if (embedded) {
    return tableEl;
  }

  const gridBody = (
    <>
      {(title || toolbar || onAdd) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-[15px] font-semibold text-[#34495E]">{title}</h2>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            {onAdd ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAdd}>
                {addLabel}
              </button>
            ) : null}
          </div>
        </div>
      )}
      <div className={shellClass}>
        <div className={scrollClass}>{tableEl}</div>
        {showFooter ? (
          <ListPaginationFooter
            page={pageValue}
            pageSize={pageSizeValue}
            total={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            labels={labels}
          />
        ) : null}
      </div>
    </>
  );

  if (layout === "fill") {
    return <div className="flex min-h-0 flex-1 flex-col">{gridBody}</div>;
  }

  return <div className="space-y-3">{gridBody}</div>;
}
