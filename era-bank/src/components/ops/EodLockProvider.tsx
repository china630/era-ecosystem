"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type EodLockContextValue = {
  locked: boolean;
  status: string | null;
  mutationsDisabled: boolean;
};

const EodLockContext = createContext<EodLockContextValue>({
  locked: false,
  status: null,
  mutationsDisabled: false,
});

export function EodLockProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/eod/${today}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (!cancelled) setStatus(data.status ?? null);
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

  const locked = status === "RUNNING";
  const value = useMemo(
    () => ({ locked, status, mutationsDisabled: locked }),
    [locked, status],
  );

  return (
    <EodLockContext.Provider value={value}>
      {locked ? (
        <div
          className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-[13px] text-amber-900"
          data-eod-lock="true"
        >
          {t("eodLockBanner", { status: status ?? "RUNNING" })}
        </div>
      ) : null}
      {children}
    </EodLockContext.Provider>
  );
}

export function useEodLock() {
  return useContext(EodLockContext);
}
