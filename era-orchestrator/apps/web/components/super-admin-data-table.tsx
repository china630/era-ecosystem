"use client";

import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
} from "@era/satellite-kit/ui";
import { useListPagination } from "../lib/use-list-pagination";

export function SuperAdminDataTable({
  columns,
  rows,
  loading,
  headers,
  emptyLabel = "No rows",
  loadingLabel = "Loading…",
}: {
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  loading?: boolean;
  /** Optional friendly header label per column key (falls back to the key). */
  headers?: Record<string, string>;
  emptyLabel?: string;
  loadingLabel?: string;
}) {
  const tCommon = useTranslations("common");
  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(rows);

  if (loading) {
    return <p className="text-sm text-[#7F8C8D]">{loadingLabel}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-[#7F8C8D]">{emptyLabel}</p>;
  }
  return (
    <div className={DATA_TABLE_VIEWPORT_CLASS}>
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            {columns.map((c) => (
              <th key={c} className={DATA_TABLE_TH_LEFT_CLASS}>
                {headers?.[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row, i) => (
            <tr key={i} className={DATA_TABLE_TR_CLASS}>
              {columns.map((k) => (
                <td key={k} className={DATA_TABLE_TD_CLASS}>
                  {String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ListPaginationFooter
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        labels={{
          rowsPerPage: tCommon("paginationRowsPerPage"),
          pageOf: tCommon("paginationPageOf"),
          prev: tCommon("paginationPrev"),
          next: tCommon("paginationNext"),
        }}
      />
    </div>
  );
}
