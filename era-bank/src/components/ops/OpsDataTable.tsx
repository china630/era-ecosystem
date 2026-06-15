"use client";

import { PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type OpsDataTableProps<T extends { id?: string }> = {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  addLabel?: string;
  onAdd?: () => void;
  emptyLabel?: string;
};

function cellValue<T extends Record<string, unknown>>(row: T, key: string): unknown {
  return row[key];
}

export function OpsDataTable<T extends { id?: string } & Record<string, unknown>>({
  rows,
  columns,
  onRowClick,
  addLabel,
  onAdd,
  emptyLabel = "No records",
}: OpsDataTableProps<T>) {
  return (
    <div className="space-y-3">
      {onAdd && addLabel ? (
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onAdd}>
          {addLabel}
        </button>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                {columns.map((col) => (
                  <th key={String(col.key)} className="px-3 py-2 font-semibold">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className={`border-b ${onRowClick ? "cursor-pointer hover:bg-muted/20" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3 py-2 align-top">
                      {col.render
                        ? col.render(row)
                        : String(cellValue(row, String(col.key)) ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
