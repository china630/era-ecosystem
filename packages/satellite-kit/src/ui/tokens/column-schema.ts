/**
 * Column schema - one declaration drives table cell + list filter.
 *
 * Rule: every list/table screen should declare columns with dataType so
 * EraListFilterBar can be generated (or hand-wired) from the same schema.
 *
 * Spec: DESIGN.md section Three-tier design tokens; ADR docs/adr/era-design-tokens-3tier.md
 */

import {
  cellAlignClass,
  resolveField,
  type FieldDataType,
  type FilterControlKind,
  type ResolvedField,
} from "./resolve-field";

export type ColumnFilterSpec = {
  kind: FilterControlKind;
  /** Form field name for draft filter state. */
  name: string;
  /** i18n label key or plain label (caller resolves). */
  label: string;
  /** For select/enum filters. */
  options?: ReadonlyArray<{ value: string; label: string }>;
};

export type ColumnSchema = {
  id: string;
  /** Header label (i18n key or plain). */
  header: string;
  dataType: FieldDataType;
  /** Accessor key on row object (optional). */
  accessor?: string;
  /** Hide filter for this column (e.g. actions). */
  filterable?: boolean;
  /** Override auto filter name (defaults to id). */
  filterName?: string;
  /** Override filter label (defaults to header). */
  filterLabel?: string;
  sortable?: boolean;
  /** Hide column from table but keep filter. */
  tableHidden?: boolean;
};

export type ResolvedColumn = ColumnSchema & {
  resolved: ResolvedField;
  cellAlignClass: string;
  filter: ColumnFilterSpec | null;
};

/**
 * Resolve a column list: cell alignment + filter specs for EraListFilterBar.
 */
export function resolveColumns(columns: readonly ColumnSchema[]): ResolvedColumn[] {
  return columns.map((col) => {
    const resolved = resolveField(col.dataType, "tableCell", "table");
    const filterable = col.filterable !== false && resolved.filterControl !== "none";
    const filter: ColumnFilterSpec | null = filterable
      ? {
          kind: resolved.filterControl,
          name: col.filterName ?? col.id,
          label: col.filterLabel ?? col.header,
        }
      : null;
    return {
      ...col,
      resolved,
      cellAlignClass: cellAlignClass(resolved.align),
      filter,
    };
  });
}

/** Filters only (skip none / non-filterable). */
export function columnFilters(columns: readonly ColumnSchema[]): ColumnFilterSpec[] {
  return resolveColumns(columns)
    .map((c) => c.filter)
    .filter((f): f is ColumnFilterSpec => f != null);
}
