"use client";

import { EraDataGrid, type EraDataGridProps } from "@era/satellite-kit/ui";
import { useListPaginationLabels } from "@/hooks/useListPaginationLabels";

type BankDataGridProps<T extends Record<string, unknown>> = Omit<
  EraDataGridProps<T>,
  "paginationLabels" | "rowKey" | "emptyMessage"
> & {
  rowKey?: (row: T) => string;
  emptyMessage?: string;
  /** @deprecated use emptyMessage */
  emptyLabel?: string;
};

/** EraDataGrid with bank i18n pagination labels (DESIGN.md list footer). */
export function BankDataGrid<T extends Record<string, unknown>>({
  emptyLabel,
  emptyMessage,
  rowKey,
  ...props
}: BankDataGridProps<T>) {
  const paginationLabels = useListPaginationLabels();
  return (
    <EraDataGrid<T>
      {...props}
      rowKey={
        rowKey ??
        ((row) =>
          String(
            (row as { id?: unknown }).id ??
              (row as { key?: unknown }).key ??
              JSON.stringify(row),
          ))
      }
      emptyMessage={emptyMessage ?? emptyLabel}
      paginationLabels={paginationLabels}
    />
  );
}
