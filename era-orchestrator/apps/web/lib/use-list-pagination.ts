"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@era/satellite-kit/ui";

/** Client-side slice pagination for Orchestrator list tables. */
export function useListPagination<T>(items: T[], resetKey?: string | number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [resetKey, items.length, pageSize]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    paged,
    total: items.length,
  };
}
