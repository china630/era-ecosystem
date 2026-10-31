"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogField, DatePicker } from "@era/satellite-kit/ui";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  LINK_ACCENT_CLASS,
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

  const bookOptions = books.map((book) => ({
    value: book.id,
    label: `${book.code} — ${book.nameEn}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("compareBooks.title")}
        subtitle={
          <>
            {t("compareBooks.subtitle")}{" "}
            <span className="block text-[12px] text-[#7F8C8D]">
              {t(
                "compareBooks.mgmtLaborHint",
                "NAS vs MGMT payroll (FOT) is not GL compare-books — use",
              )}{" "}
              <Link href="/hr/mgmt-labor-delta" className={LINK_ACCENT_CLASS}>
                {t("compareBooks.mgmtLaborLink", "MGMT labor delta")}
              </Link>
              .
            </span>
          </>
        }
        leading={
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem]">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("compareBooks.bookA")}
                value={bookA}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  setBookA(v);
                }}
                options={bookOptions}
              />
            </div>
            <div className="min-w-[12rem]">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("compareBooks.bookB")}
                value={bookB}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  setBookB(v);
                }}
                options={bookOptions}
              />
            </div>
            <DatePicker
              label={t("compareBooks.dateFrom")}
              value={dateFrom}
              onChange={setDateFrom}
              placeholder={t("ui.datePickerPlaceholder")}
            />
            <DatePicker
              label={t("compareBooks.dateTo")}
              value={dateTo}
              onChange={setDateTo}
              placeholder={t("ui.datePickerPlaceholder")}
            />
          </div>
        }
        actions={
          <Button
            type="button"
            variant="primary"
            disabled={busy || books.length < 2}
            onClick={() => void compare()}
          >
            {busy ? "…" : t("compareBooks.load")}
          </Button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {[result.bookA, result.bookB].map((side) => (
            <section key={side.book.id} className={CARD_CONTAINER_CLASS}>
              <div className="border-b border-slate-200 p-4">
                <h2 className="m-0 font-semibold">
                  {side.book.code} — {side.book.nameEn}
                </h2>
                <p className="m-0 mt-1 text-sm text-slate-600">
                  {t("compareBooks.periodTotals")}:{" "}
                  {formatMoneyAzn(side.totals.periodDebit)} /{" "}
                  {formatMoneyAzn(side.totals.periodCredit)}
                </p>
              </div>
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("compareBooks.account")}</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("compareBooks.debit")}</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("compareBooks.credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {side.rows.map((row) => (
                      <tr key={row.accountId} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <span className="font-mono">{row.accountCode}</span> {row.accountName}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {formatMoneyAzn(row.periodDebit)}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
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
