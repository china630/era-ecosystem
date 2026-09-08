export const LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_LIST_PAGE_SIZE = 25;

export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListPagination = {
  page: number;
  pageSize: number;
  skip: number;
};

const PAGE_SIZE_SET = new Set<number>(LIST_PAGE_SIZE_OPTIONS);

/**
 * Server-side list pagination (satellite list standard).
 * Caps pageSize at 100 and snaps to 25/50/100 when possible.
 */
export function normalizeListPagination(
  page?: number,
  pageSize?: number,
  defaultPageSize: number = DEFAULT_LIST_PAGE_SIZE,
): ListPagination {
  const p = Math.max(1, Math.floor(page ?? 1) || 1);
  const raw = pageSize ?? defaultPageSize;
  const snapped = PAGE_SIZE_SET.has(raw)
    ? raw
    : Math.min(100, Math.max(1, Math.floor(raw) || defaultPageSize));
  const ps = PAGE_SIZE_SET.has(snapped)
    ? snapped
    : DEFAULT_LIST_PAGE_SIZE;
  return { page: p, pageSize: ps, skip: (p - 1) * ps };
}

/**
 * Parses `{ items, total, page, pageSize }`, clinic `{ data, total, ... }`,
 * or a legacy JSON array (total = length).
 * Does not treat API page/pageSize as authoritative for UI state — callers
 * should keep their own page controls (avoid echo races).
 */
export function parsePaginatedList<T>(json: unknown): PaginatedList<T> {
  if (Array.isArray(json)) {
    const arr = json as T[];
    return {
      items: arr,
      total: arr.length,
      page: 1,
      pageSize: arr.length || DEFAULT_LIST_PAGE_SIZE,
    };
  }
  if (!json || typeof json !== "object") {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_LIST_PAGE_SIZE,
    };
  }
  const o = json as Record<string, unknown>;
  // Nested clinic envelope: { data: { data|items, total, ... } }
  const nested =
    o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : null;
  const src = nested ?? o;
  const itemsRaw = src.items ?? src.data;
  const items = Array.isArray(itemsRaw) ? (itemsRaw as T[]) : [];
  return {
    items,
    total: typeof src.total === "number" ? src.total : items.length,
    page: typeof src.page === "number" ? src.page : 1,
    pageSize:
      typeof src.pageSize === "number" ? src.pageSize : DEFAULT_LIST_PAGE_SIZE,
  };
}
