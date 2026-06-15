"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type OpsModalMode = "create" | "detail" | "edit" | null;

export function useOpsModal(paramId = "id", paramMode = "modal") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = useMemo((): OpsModalMode => {
    const m = searchParams.get(paramMode);
    if (m === "create" || m === "detail" || m === "edit") return m;
    if (searchParams.get(paramId)) return "detail";
    return null;
  }, [searchParams, paramId, paramMode]);

  const entityId = searchParams.get(paramId);

  const open = useCallback(
    (nextMode: Exclude<OpsModalMode, null>, id?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramMode, nextMode);
      if (id) params.set(paramId, id);
      else params.delete(paramId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramId, paramMode],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramMode);
    params.delete(paramId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams, paramId, paramMode]);

  return { mode, entityId, open, close, isOpen: mode !== null };
}
