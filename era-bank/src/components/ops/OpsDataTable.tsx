"use client";

import type { ReactNode } from "react";
import { PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { BankDataGrid } from "@/components/BankDataGrid";

/**
 * @deprecated Prefer BankDataGrid + EraListFilterBar directly.
 * Thin adapter kept so remaining hub pages share kit chrome.
 */
type OpsColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

type OpsDataTableProps<T extends { id?: string }> = {
  rows: T[];
  columns: OpsColumn<T>[];
  emptyLabel?: string;
  addLabel?: string;
  onAdd?: () => void;
  onRowClick?: (row: T) => void;
};

export function OpsDataTable<
  T extends { id?: string } & Record<string, unknown>,
>({
  rows,
  columns,
  emptyLabel = "No rows",
  addLabel,
  onAdd,
  onRowClick,
}: OpsDataTableProps<T>) {
  return (
    <div className="space-y-3">
      {onAdd && addLabel ? (
        <div className="flex justify-end">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAdd}>
            {addLabel}
          </button>
        </div>
      ) : null}
      <BankDataGrid
        columns={columns.map((c) => ({
          key: c.key,
          header: c.label,
          render: c.render
            ? (row: T) => {
                const node = c.render!(row);
                if (onRowClick) {
                  return (
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => onRowClick(row)}
                    >
                      {node}
                    </button>
                  );
                }
                return node;
              }
            : onRowClick
              ? (row: T) => (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => onRowClick(row)}
                  >
                    {String(row[c.key] ?? "—")}
                  </button>
                )
              : undefined,
        }))}
        rows={rows}
        emptyMessage={emptyLabel}
      />
    </div>
  );
}
