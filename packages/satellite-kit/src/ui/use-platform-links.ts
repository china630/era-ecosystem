"use client";

import { useEffect, useState } from "react";
import type { PlatformLinksBody } from "../platform/platform-links";

export type PlatformLinksState = {
  links: PlatformLinksBody | null;
  loading: boolean;
};

/**
 * Fetch cabinet register/pricing/help URLs from the satellite API
 * (Sync-backed; never baked NEXT_PUBLIC localhost).
 */
export function usePlatformLinks(): PlatformLinksState {
  const [links, setLinks] = useState<PlatformLinksBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/platform-links", {
          method: "GET",
          credentials: "same-origin",
        });
        const json = (await res.json().catch(() => null)) as PlatformLinksBody | null;
        if (!cancelled && json && typeof json === "object") {
          setLinks(json);
        }
      } catch {
        if (!cancelled) setLinks(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { links, loading };
}
