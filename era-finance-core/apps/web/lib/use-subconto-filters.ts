"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api-client";

export type SubcontoType = {
  id: string;
  code: string;
  name: string;
  kind: string;
};

export function useSubcontoFilters(token: string | null) {
  const [types, setTypes] = useState<SubcontoType[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setTypes([]);
      setEnabled(false);
      setReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [statusRes, typesRes] = await Promise.all([
        apiFetch("/api/accounting/subconto/feature-status"),
        apiFetch("/api/accounting/subconto/types"),
      ]);
      if (cancelled) return;
      if (statusRes.ok) {
        const j = (await statusRes.json()) as { enabled?: boolean };
        setEnabled(Boolean(j.enabled));
      } else {
        setEnabled(false);
      }
      if (typesRes.ok) {
        setTypes((await typesRes.json()) as SubcontoType[]);
      } else {
        setTypes([]);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { types, enabled, ready };
}
