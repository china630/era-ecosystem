"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldSelect } from "@era/satellite-kit/ui";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Book = {
  id: string;
  code: string;
  nameEn: string;
  status: string;
};

type CompareSide = {
  book: Book;
  rows: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  }>;
  totals: { periodDebit: string; periodCredit: string };
};

type ComparePayload = {
  dateFrom: string;
  dateTo: string;
  bookA: CompareSide;
  bookB: CompareSide;
};

function defaultDates() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const last = new Date(Date.UTC(year, now.getUTCMonth() + 1, 0))
    .getUTCDate()
    .toString()
    .padStart(2, "0");
  return { dateFrom: `${year}-${month}-01`, dateTo: `${year}-${month}-${last}` };
}

export default function CompareBooksPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookA, setBookA] = useState("");
  const [bookB, setBookB] = useState("");
  const dates = defaultDates();
  const [dateFrom, setDateFrom] = useState(dates.dateFrom);
  const [dateTo, setDateTo] = useState(dates.dateTo);
  const [result, setResult] = useState<ComparePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    if (!token) return;
    const response = await apiFetch("/api/accounting/books");
    if (!response.ok) {
      setError(t("compareBooks.loadError"));
      return;
    }
    const rows = ((await response.json()) as Book[]).filter(
      (book) => book.status === "ACTIVE",
    );
    setBooks(rows);
    setBookA((value) => value || rows[0]?.id || "");
    setBookB((value) => value || rows[1]?.id || "");
  }, [t, token]);

  useEffect(() => {
    if (ready && token) void loadBooks();
  }, [ready, token, loadBooks]);

  async function compare() {
    if (!bookA || !bookB || bookA === bookB) {
      setError(t("compareBooks.chooseDifferent"));
      return;
    }
    setBusy(true);
    setError(null);
    const query = new URLSearchParams({ bookA, bookB, dateFrom, dateTo });
    const response = await apiFetch(
      `/api/reporting/compare-books?${query.toString()}`,
    );
    setBusy(false);
    if (!response.ok) {
      setError(t("compareBooks.loadError"));
      setResult(null);
      return;
    }
    setResult((await response.json()) as ComparePayload);
  }

  if (!ready) return <p>{t("common.loading")}</p>;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("compareBooks.title")}
        subtitle={t("compareBooks.subtitle")}
      />
      <div className={`${CARD_CONTAINER_CLASS} grid gap-3 p-4 md:grid-cols-5`}>
        <FieldSelect
          label={t("compareBooks.bookA")}
          preset="selectWide"
          value={bookA}
          onChange={(event) => setBookA(event.target.value)}
        >
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.code} — {book.nameEn}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          label={t("compareBooks.bookB")}
          preset="selectWide"
          value={bookB}
          onChange={(event) => setBookB(event.target.value)}
        >
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.code} — {book.nameEn}
            </option>
          ))}
        </FieldSelect>
        <Field
          label={t("compareBooks.dateFrom")}
          preset="date"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <Field
          label={t("compareBooks.dateTo")}
          preset="date"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <div className="flex items-end">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || books.length < 2}
            onClick={() => void compare()}
          >
            {busy ? "…" : t("compareBooks.load")}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {[result.bookA, result.bookB].map((side) => (
            <section key={side.book.id} className={CARD_CONTAINER_CLASS}>
              <div className="border-b border-slate-200 p-4">
                <h2 className="font-semibold">
                  {side.book.code} — {side.book.nameEn}
                </h2>
                <p className="text-sm text-slate-600">
                  {t("compareBooks.periodTotals")}:{" "}
                  {formatMoneyAzn(side.totals.periodDebit)} /{" "}
                  {formatMoneyAzn(side.totals.periodCredit)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="p-2 text-left">{t("compareBooks.account")}</th>
                      <th className="p-2 text-right">{t("compareBooks.debit")}</th>
                      <th className="p-2 text-right">{t("compareBooks.credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {side.rows.map((row) => (
                      <tr key={row.accountId} className="border-t border-slate-100">
                        <td className="p-2">
                          <span className="font-mono">{row.accountCode}</span>{" "}
                          {row.accountName}
                        </td>
                        <td className="p-2 text-right">
                          {formatMoneyAzn(row.periodDebit)}
                        </td>
                        <td className="p-2 text-right">
                          {formatMoneyAzn(row.periodCredit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
