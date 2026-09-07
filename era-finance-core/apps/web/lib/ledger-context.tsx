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

/** API-compatible ledger filter; MANAGEMENT for extra books. */
export type LedgerType = "NAS" | "IFRS" | "MANAGEMENT";

export type AccountingBookSummary = {
  id: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  gaapKind: string;
  status: string;
  isSystem: boolean;
  isDefaultOps?: boolean;
};

const STORAGE_LEDGER_KEY = "erafinance-ledger-type";
const STORAGE_BOOK_KEY = "erafinance-accounting-book-id";

function readStoredLedger(): LedgerType {
  if (typeof window === "undefined") return "NAS";
  const v = localStorage.getItem(STORAGE_LEDGER_KEY);
  if (v === "IFRS" || v === "MANAGEMENT") return v;
  return "NAS";
}

function readStoredBookId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_BOOK_KEY);
}

function ledgerTypeFromBook(book: AccountingBookSummary | null): LedgerType {
  if (!book) return "NAS";
  const kind = String(book.gaapKind || book.code).toUpperCase();
  if (kind === "IFRS") return "IFRS";
  if (kind === "MANAGEMENT" || kind === "TAX" || kind === "CUSTOM") {
    return "MANAGEMENT";
  }
  return "NAS";
}

type LedgerContextValue = {
  ledgerType: LedgerType;
  /** Legacy: selects system NAS/IFRS book when present. */
  setLedgerType: (v: LedgerType) => void;
  accountingBookId: string | null;
  books: AccountingBookSummary[];
  activeBook: AccountingBookSummary | null;
  setActiveBookId: (id: string) => void;
  refreshBooks: () => Promise<void>;
  ready: boolean;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { token, organizationId, ready: authReady } = useAuth();
  const [ledgerType, setLedgerTypeState] = useState<LedgerType>("NAS");
  const [accountingBookId, setAccountingBookIdState] = useState<string | null>(
    null,
  );
  const [books, setBooks] = useState<AccountingBookSummary[]>([]);
  const [ready, setReady] = useState(false);

  const applyBook = useCallback((book: AccountingBookSummary | null) => {
    if (!book) {
      setAccountingBookIdState(null);
      setLedgerTypeState("NAS");
      return;
    }
    const nextLedger = ledgerTypeFromBook(book);
    setAccountingBookIdState(book.id);
    setLedgerTypeState(nextLedger);
    try {
      localStorage.setItem(STORAGE_BOOK_KEY, book.id);
      localStorage.setItem(STORAGE_LEDGER_KEY, nextLedger);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshBooks = useCallback(async () => {
    if (!token || !organizationId) {
      setBooks([]);
      return;
    }
    try {
      const res = await apiFetch("/api/accounting/books");
      if (!res.ok) {
        setBooks([]);
        return;
      }
      const list = (await res.json()) as AccountingBookSummary[];
      const active = list.filter((b) => b.status === "ACTIVE");
      setBooks(active);

      const storedId = readStoredBookId();
      const storedLedger = readStoredLedger();
      const byId = storedId
        ? active.find((b) => b.id === storedId)
        : undefined;
      const byLedger =
        !byId &&
        active.find(
          (b) =>
            b.code === storedLedger ||
            b.gaapKind === storedLedger ||
            (storedLedger === "NAS" && b.isDefaultOps),
        );
      const fallback =
        active.find((b) => b.isDefaultOps) ||
        active.find((b) => b.code === "NAS") ||
        active[0] ||
        null;
      applyBook(byId || byLedger || fallback);
    } catch {
      setBooks([]);
    }
  }, [applyBook, organizationId, token]);

  useEffect(() => {
    if (!authReady) return;
    if (!token || !organizationId) {
      setBooks([]);
      setAccountingBookIdState(null);
      setLedgerTypeState(readStoredLedger());
      setReady(true);
      return;
    }
    void (async () => {
      await refreshBooks();
      setReady(true);
    })();
  }, [authReady, token, organizationId, refreshBooks]);

  const setActiveBookId = useCallback(
    (id: string) => {
      const book = books.find((b) => b.id === id) ?? null;
      applyBook(book);
    },
    [applyBook, books],
  );

  const setLedgerType = useCallback(
    (v: LedgerType) => {
      const match =
        books.find((b) => b.code === v || b.gaapKind === v) ||
        (v === "NAS"
          ? books.find((b) => b.isDefaultOps) || books.find((b) => b.code === "NAS")
          : null);
      if (match) {
        applyBook(match);
        return;
      }
      setLedgerTypeState(v);
      try {
        localStorage.setItem(STORAGE_LEDGER_KEY, v);
      } catch {
        /* ignore */
      }
    },
    [applyBook, books],
  );

  const activeBook = useMemo(
    () => books.find((b) => b.id === accountingBookId) ?? null,
    [books, accountingBookId],
  );

  const value = useMemo(
    () => ({
      ledgerType,
      setLedgerType,
      accountingBookId,
      books,
      activeBook,
      setActiveBookId,
      refreshBooks,
      ready,
    }),
    [
      ledgerType,
      setLedgerType,
      accountingBookId,
      books,
      activeBook,
      setActiveBookId,
      refreshBooks,
      ready,
    ],
  );

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error("useLedger must be used within LedgerProvider");
  }
  return ctx;
}

/** Query string for API (?ledgerType=…&accountingBookId=…&bookCode=…) */
export function ledgerQueryParam(
  ledgerType: LedgerType,
  accountingBookId?: string | null,
  bookCode?: string | null,
): string {
  const parts = [`ledgerType=${encodeURIComponent(ledgerType)}`];
  if (accountingBookId) {
    parts.push(`accountingBookId=${encodeURIComponent(accountingBookId)}`);
  }
  if (bookCode) {
    parts.push(`bookCode=${encodeURIComponent(bookCode)}`);
  }
  return parts.join("&");
}

/** Holdings cross-org: prefer stable bookCode; omit local UUID so peers resolve by code. */
export function holdingLedgerQueryParam(
  ledgerType: LedgerType,
  bookCode?: string | null,
): string {
  return ledgerQueryParam(ledgerType, null, bookCode);
}
