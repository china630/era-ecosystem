"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
} from "./list-pagination-footer";
import {
  parsePaginatedList,
  type PaginatedList,
} from "./paginated-list";
import { useDebouncedValue } from "./use-debounced-value";

export type UsePaginatedListOptions<TFilters extends Record<string, unknown>> = {
  /** Called whenever page, pageSize, or filters (after debounce for `q`) change. */
  fetcher: (args: {
    page: number;
    pageSize: number;
    filters: TFilters;
  }) => Promise<unknown>;
  /** Initial / controlled filter bag. Changes reset page to 1. */
  filters: TFilters;
  /** Debounce `filters.q` when it is a string (default 300ms). */
  debounceMs?: number;
  defaultPageSize?: number;
  /** When false, skip the initial/auto fetch (default true). */
  enabled?: boolean;
};

export type UsePaginatedListResult<T, TFilters extends Record<string, unknown>> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  loading: boolean;
  error: unknown;
  filters: TFilters;
  /** Effective filters after debounce of `q`. */
  activeFilters: TFilters;
  reload: () => Promise<void>;
  lastResult: PaginatedList<T> | null;
};

function debounceKey<TFilters extends Record<string, unknown>>(
  filters: TFilters,
  debouncedQ: string | undefined,
): TFilters {
  if (!("q" in filters) || typeof filters.q !== "string") return filters;
  return { ...filters, q: debouncedQ ?? "" };
}

/**
 * Server-list state: page + pageSize + filters.
 * Resets to page 1 when filters change. Never echoes page/pageSize from the API.
 */
export function usePaginatedList<
  T,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
>({
  fetcher,
  filters,
  debounceMs = 300,
  defaultPageSize = DEFAULT_LIST_PAGE_SIZE,
  enabled = true,
}: UsePaginatedListOptions<TFilters>): UsePaginatedListResult<T, TFilters> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lastResult, setLastResult] = useState<PaginatedList<T> | null>(null);

  const qRaw = typeof filters.q === "string" ? filters.q : undefined;
  const debouncedQ = useDebouncedValue(qRaw ?? "", debounceMs);
  const activeFilters = useMemo(
    () => debounceKey(filters, qRaw === undefined ? undefined : debouncedQ),
    [filters, qRaw, debouncedQ],
  );

  const filterResetKey = useMemo(
    () => JSON.stringify(activeFilters),
    [activeFilters],
  );
  const prevFilterKey = useRef(filterResetKey);

  useEffect(() => {
    if (prevFilterKey.current !== filterResetKey) {
      prevFilterKey.current = filterResetKey;
      setPage(1);
    }
  }, [filterResetKey]);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetcherRef.current({
        page,
        pageSize,
        filters: activeFilters,
      });
      const parsed = parsePaginatedList<T>(json);
      setItems(parsed.items);
      setTotal(parsed.total);
      setLastResult(parsed);
      // Intentionally do not setPage / setPageSize from API (echo race).
    } catch (e) {
      setError(e);
      setItems([]);
      setTotal(0);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, page, pageSize, activeFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  const setPageSize = useCallback((n: number) => {
    const next = LIST_PAGE_SIZE_OPTIONS.includes(
      n as (typeof LIST_PAGE_SIZE_OPTIONS)[number],
    )
      ? n
      : DEFAULT_LIST_PAGE_SIZE;
    setPageSizeState(next);
    setPage(1);
  }, []);

  return {
    items,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    error,
    filters,
    activeFilters,
    reload: load,
    lastResult,
  };
}
