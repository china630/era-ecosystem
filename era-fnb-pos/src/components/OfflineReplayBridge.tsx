"use client";

import { useEffect } from "react";
import {
  enqueueOfflineAction,
  listOfflineActions,
  removeOfflineAction,
} from "@/lib/offline-queue";

export default function OfflineReplayBridge() {
  useEffect(() => {
    async function replay() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const queued = await listOfflineActions();
      if (queued.length === 0) return;
      const res = await fetch("/api/offline/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: queued }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        results?: Array<{ id: string; ok: boolean }>;
      };
      for (const r of data.results ?? []) {
        if (r.ok) await removeOfflineAction(r.id);
      }
    }

    const onOfflinePay = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { kind: "pay" | "fire"; ticketId: string; payload: Record<string, unknown> }
        | undefined;
      if (!detail) return;
      void enqueueOfflineAction(detail);
    };

    window.addEventListener("online", () => void replay());
    window.addEventListener("era-fnb-offline", onOfflinePay as EventListener);
    void replay();
    return () => {
      window.removeEventListener("online", () => void replay());
      window.removeEventListener("era-fnb-offline", onOfflinePay as EventListener);
    };
  }, []);
  return null;
}
