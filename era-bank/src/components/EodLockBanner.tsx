"use client";

import { useEffect, useState } from "react";

export function EodLockBanner() {
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/eod/${today}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        setStatus(data.status ?? null);
        setLocked(data.status === "RUNNING");
      } catch {
        /* ignore */
      }
    }

    void poll();
    const id = setInterval(() => void poll(), 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!locked) return null;

  return (
    <div
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-[13px] text-amber-900"
      data-eod-lock="true"
    >
      EOD is {status ?? "RUNNING"} — mutations are blocked until batch completes.
    </div>
  );
}

export function useEodLocked(): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const el = document.querySelector('[data-eod-lock="true"]');
    setLocked(Boolean(el));
    const obs = new MutationObserver(() => {
      setLocked(Boolean(document.querySelector('[data-eod-lock="true"]')));
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return locked;
}
