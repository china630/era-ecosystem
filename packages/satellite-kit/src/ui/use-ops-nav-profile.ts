"use client";

import { useEffect, useState } from "react";
import { opsNavProfileFromMe, type OpsNavProfile, type OpsNavStatus } from "./ops-nav-conditions";

export * from "./ops-nav-conditions";

/** Window event that makes every mounted ops shell re-read `/api/auth/me` (e.g. after a grants change). */
export const OPS_NAV_PROFILE_REFRESH_EVENT = "era-ops-nav-refresh";

/**
 * One profile read for the ops shell. Stays `loading` through a single retry.
 * A failed read does not invent a menu. A refresh event keeps the current menu until the new read lands.
 */
export function useOpsNavProfile(options?: { refreshEvents?: readonly string[] }): {
  profile: OpsNavProfile | null;
  status: OpsNavStatus;
} {
  const [profile, setProfile] = useState<OpsNavProfile | null>(null);
  const [status, setStatus] = useState<OpsNavStatus>("loading");
  const refreshKey = (options?.refreshEvents ?? []).join("|");

  useEffect(() => {
    let cancelled = false;
    const events = [OPS_NAV_PROFILE_REFRESH_EVENT, ...refreshKey.split("|").filter(Boolean)];
    const onRefresh = () => void load();
    for (const name of events) window.addEventListener(name, onRefresh);
    async function load() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await fetch("/api/auth/me", { cache: "no-store" });
          if (!res.ok) continue;
          const next = opsNavProfileFromMe(await res.json());
          if (!next) continue;
          if (cancelled) return;
          setProfile(next);
          setStatus("ready");
          return;
        } catch {
          /* retry once */
        }
      }
      if (!cancelled) setStatus((prev) => (prev === "ready" ? "ready" : "error"));
    }
    void load();
    return () => {
      cancelled = true;
      for (const name of events) window.removeEventListener(name, onRefresh);
    };
  }, [refreshKey]);

  return { profile, status };
}
