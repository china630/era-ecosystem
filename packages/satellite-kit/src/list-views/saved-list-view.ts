/**
 * Saved list-view config validation — ADR extensibility-forms-print-reports.md W2.
 * Persists whitelist columns/filters/sort/pageSize only — never ad-hoc SQL.
 */

import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
  normalizeListPagination,
} from "../ui/paginated-list";

export const SAVED_LIST_VIEW_GRID_FINANCE_INVOICE =
  "FINANCE_INVOICE_LIST" as const;

export type SavedListViewGridKey = typeof SAVED_LIST_VIEW_GRID_FINANCE_INVOICE;

export type SavedListViewSortDir = "asc" | "desc";

export type SavedListViewConfig = {
  version: 1;
  columns: string[];
  filters: Record<string, string | string[]>;
  sort?: { key: string; dir: SavedListViewSortDir };
  pageSize: (typeof LIST_PAGE_SIZE_OPTIONS)[number];
};

export type SavedListViewSchema = {
  gridKey: string;
  columns: readonly string[];
  /** Column ids that must always stay visible (e.g. actions). */
  requiredColumns?: readonly string[];
  /** Column ids no longer offered — stripped silently on normalize. */
  retiredColumns?: readonly string[];
  filters: readonly string[];
  sortKeys: readonly string[];
  defaultSort?: { key: string; dir: SavedListViewSortDir };
};

export type SavedListViewIssueCode =
  | "SAVED_VIEW_UNKNOWN_KEY"
  | "SAVED_VIEW_TYPE"
  | "SAVED_VIEW_EMPTY_COLUMNS"
  | "SAVED_VIEW_GRID";

export type SavedListViewIssue = {
  code: SavedListViewIssueCode;
  keys: string[];
  message: string;
};

export type SavedListViewResult =
  | { ok: true; value: SavedListViewConfig }
  | { ok: false; issue: SavedListViewIssue };

function issue(
  code: SavedListViewIssueCode,
  keys: string[],
  message: string,
): SavedListViewResult {
  return { ok: false, issue: { code, keys, message } };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Normalize a saved-view payload against a per-grid schema.
 * Unknown column/filter/sort keys → 400. Retired columns are dropped.
 */
export function normalizeSavedListView(
  schema: SavedListViewSchema,
  raw: unknown,
): SavedListViewResult {
  if (!isPlainObject(raw)) {
    return issue("SAVED_VIEW_TYPE", [], "Saved view config must be an object");
  }

  const version = raw.version;
  if (version !== 1 && version !== undefined) {
    return issue("SAVED_VIEW_TYPE", ["version"], "Unsupported saved view version");
  }

  const allowedColumns = new Set(schema.columns);
  const retired = new Set(schema.retiredColumns ?? []);
  const required = schema.requiredColumns ?? [];
  const allowedFilters = new Set(schema.filters);
  const allowedSort = new Set(schema.sortKeys);

  const rawColumns = raw.columns;
  if (!Array.isArray(rawColumns)) {
    return issue("SAVED_VIEW_TYPE", ["columns"], "columns must be an array");
  }
  if (rawColumns.length === 0) {
    return issue(
      "SAVED_VIEW_EMPTY_COLUMNS",
      [],
      "At least one column is required",
    );
  }

  const unknownCols: string[] = [];
  const columns: string[] = [];
  for (const c of rawColumns) {
    if (typeof c !== "string") {
      return issue("SAVED_VIEW_TYPE", ["columns"], "columns must be string ids");
    }
    if (retired.has(c)) continue;
    if (!allowedColumns.has(c)) {
      unknownCols.push(c);
      continue;
    }
    if (!columns.includes(c)) columns.push(c);
  }
  if (unknownCols.length > 0) {
    return issue(
      "SAVED_VIEW_UNKNOWN_KEY",
      unknownCols,
      `Unknown column(s): ${unknownCols.join(", ")}`,
    );
  }
  if (columns.length === 0) {
    return issue(
      "SAVED_VIEW_EMPTY_COLUMNS",
      [],
      "At least one column is required",
    );
  }
  for (const req of required) {
    if (allowedColumns.has(req) && !columns.includes(req)) {
      columns.push(req);
    }
  }

  const filters: Record<string, string | string[]> = {};
  const rawFilters = raw.filters;
  if (rawFilters != null) {
    if (!isPlainObject(rawFilters)) {
      return issue("SAVED_VIEW_TYPE", ["filters"], "filters must be an object");
    }
    const unknownFilters: string[] = [];
    for (const [k, v] of Object.entries(rawFilters)) {
      if (!allowedFilters.has(k)) {
        unknownFilters.push(k);
        continue;
      }
      if (typeof v === "string") {
        if (v.trim() !== "") filters[k] = v;
        continue;
      }
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
        const cleaned = (v as string[]).map((s) => s.trim()).filter(Boolean);
        if (cleaned.length > 0) filters[k] = cleaned;
        continue;
      }
      return issue(
        "SAVED_VIEW_TYPE",
        [k],
        `Filter ${k} must be a string or string[]`,
      );
    }
    if (unknownFilters.length > 0) {
      return issue(
        "SAVED_VIEW_UNKNOWN_KEY",
        unknownFilters,
        `Unknown filter(s): ${unknownFilters.join(", ")}`,
      );
    }
  }

  let sort: SavedListViewConfig["sort"];
  if (raw.sort != null) {
    if (!isPlainObject(raw.sort)) {
      return issue("SAVED_VIEW_TYPE", ["sort"], "sort must be an object");
    }
    const key = raw.sort.key;
    const dir = raw.sort.dir;
    if (typeof key !== "string" || !allowedSort.has(key)) {
      return issue(
        "SAVED_VIEW_UNKNOWN_KEY",
        [typeof key === "string" ? key : "sort"],
        `Unknown sort key: ${String(key)}`,
      );
    }
    if (dir !== "asc" && dir !== "desc") {
      return issue("SAVED_VIEW_TYPE", ["sort.dir"], "sort.dir must be asc|desc");
    }
    sort = { key, dir };
  } else if (schema.defaultSort) {
    sort = { ...schema.defaultSort };
  }

  const pageNorm = normalizeListPagination(1, raw.pageSize as number | undefined);
  const pageSize = LIST_PAGE_SIZE_OPTIONS.includes(
    pageNorm.pageSize as (typeof LIST_PAGE_SIZE_OPTIONS)[number],
  )
    ? (pageNorm.pageSize as (typeof LIST_PAGE_SIZE_OPTIONS)[number])
    : DEFAULT_LIST_PAGE_SIZE;

  return {
    ok: true,
    value: {
      version: 1,
      columns,
      filters,
      ...(sort ? { sort } : {}),
      pageSize,
    },
  };
}

export function assertSavedListViewGridKey(
  gridKey: string,
  allowed: readonly string[],
): SavedListViewResult | null {
  if (!allowed.includes(gridKey)) {
    return issue(
      "SAVED_VIEW_GRID",
      [gridKey],
      `Unsupported saved-view grid: ${gridKey}`,
    );
  }
  return null;
}
