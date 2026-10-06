"use client";

import { DATA_TABLE_TH_LEFT_CLASS } from "@era/satellite-kit/ui";

export type ColumnSort = { key: string; dir: "asc" | "desc" };

export function toggleColumnSort(current: ColumnSort | null, key: string): ColumnSort {
  if (current?.key === key && current.dir === "asc") return { key, dir: "desc" };
  return { key, dir: "asc" };
}

export function compareColumnValues(a: unknown, b: unknown, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  const aEmpty = a == null || a === "";
  const bEmpty = b == null || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * sign;
  }
  return (
    String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * sign
  );
}

export function sortRows<T>(
  rows: T[],
  sort: ColumnSort | null,
  valueOf: (row: T, key: string) => unknown,
): T[] {
  if (!sort) return rows;
  const { key, dir } = sort;
  return [...rows].sort((a, b) => compareColumnValues(valueOf(a, key), valueOf(b, key), dir));
}

export function SortableTh({
  label,
  columnKey,
  sort,
  onSort,
}: {
  label: string;
  columnKey: string;
  sort: ColumnSort | null;
  onSort: (key: string) => void;
}) {
  const active = sort?.key === columnKey;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={DATA_TABLE_TH_LEFT_CLASS}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left font-semibold text-inherit"
        onClick={() => onSort(columnKey)}
      >
        {label}
        <span className="text-[10px] text-[#7F8C8D]" aria-hidden>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
