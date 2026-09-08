"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";
import { useAuth } from "./auth-context";
import { useLedger } from "./ledger-context";

export type LedgerPeriodLockContextValue = {
  /** `YYYY-MM-DD` границы закрытого периода (включительно); `null` — нет блокировки. */
  lockedPeriodUntil: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const LedgerPeriodLockContext = createContext<LedgerPeriodLockContextValue | null>(null);

function pickLockDate(
  ledger: {
    lockedPeriodUntil?: string | null;
    lockedPeriodUntilByLedger?: Record<string, string | null | undefined>;
    lockedPeriodUntilByBookId?: Record<string, string | null | undefined>;
  } | undefined,
  ledgerType: string,
  bookId: string | null,
): string | null {
  if (bookId) {
    const byBook = ledger?.lockedPeriodUntilByBookId?.[bookId];
    if (typeof byBook === "string" && byBook.trim().length >= 10) {
      return byBook.trim().slice(0, 10);
    }
  }
  const by = ledger?.lockedPeriodUntilByLedger?.[ledgerType];
  const raw =
    typeof by === "string" && by.trim()
      ? by
      : ledgerType === "NAS"
        ? ledger?.lockedPeriodUntil
        : null;
  const s = typeof raw === "string" ? raw.trim().slice(0, 10) : "";
  return s.length >= 10 ? s : null;
}

export function LedgerPeriodLockProvider({ children }: { children: ReactNode }) {
  const { token, organizationId } = useAuth();
  const { ledgerType, accountingBookId } = useLedger();
  const [locks, setLocks] = useState<{
    lockedPeriodUntil?: string | null;
    lockedPeriodUntilByLedger?: Record<string, string | null | undefined>;
    lockedPeriodUntilByBookId?: Record<string, string | null | undefined>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !organizationId) {
      setLocks(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/organization/settings");
      if (!res.ok) {
        setLocks(null);
        return;
      }
      const o = (await res.json()) as {
        settings?: {
          ledger?: {
            lockedPeriodUntil?: string | null;
            lockedPeriodUntilByLedger?: Record<
              string,
              string | null | undefined
            >;
            lockedPeriodUntilByBookId?: Record<
              string,
              string | null | undefined
            >;
          };
        };
      };
      setLocks(o.settings?.ledger ?? null);
    } catch {
      setLocks(null);
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lockedPeriodUntil = pickLockDate(
    locks ?? undefined,
    ledgerType,
    accountingBookId,
  );

  const value = useMemo(
    () => ({
      lockedPeriodUntil,
      loading,
      refresh,
    }),
    [lockedPeriodUntil, loading, refresh],
  );

  return (
    <LedgerPeriodLockContext.Provider value={value}>{children}</LedgerPeriodLockContext.Provider>
  );
}

export function useLedgerPeriodLock(): LedgerPeriodLockContextValue {
  const ctx = useContext(LedgerPeriodLockContext);
  if (!ctx) {
    return {
      lockedPeriodUntil: null,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
