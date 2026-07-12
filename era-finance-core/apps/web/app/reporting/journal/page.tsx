"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { ledgerQueryParam, useLedger } from "../../../lib/ledger-context";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

type AccountOpt = { id: string; code: string; nameRu?: string; nameEn?: string; nameAz?: string };
type JournalLine = {
  journalEntryId: string;
  date: string;
  reference: string | null;
  description: string | null;
  accountCode: string;
  accountName: string;
  counterpartyName: string | null;
  departmentName: string | null;
  debit: string;
  credit: string;
};

export default function JournalPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const b = monthBounds();
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [lines, setLines] = useState<JournalLine[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const take = 200;
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!token || !ledgerReady) return;
    void (async () => {
      const res = await apiFetch(`/api/accounts?${ledgerQueryParam(ledgerType)}`);
      if (!res.ok) return;
      setAccounts((await res.json()) as AccountOpt[]);
    })();
  }, [token, ledgerReady, ledgerType]);

  const load = useCallback(async (nextSkip = 0) => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        ledgerType,
        skip: String(nextSkip),
        take: String(take),
      });
      if (accountCode.trim()) qs.set("accountCode", accountCode.trim());
      const res = await apiFetch(`/api/reporting/general-ledger?${qs.toString()}`);
      if (!res.ok) {
        setErr(`${t("reporting.journal.err")}: ${res.status}`);
        setLines(null);
        return;
      }
      const j = (await res.json()) as { lines: JournalLine[]; total: number; skip: number };
      setLines(j.lines);
      setTotal(j.total);
      setSkip(j.skip);
    } finally {
      setLoading(false);
    }
  }, [token, from, to, ledgerType, accountCode, t]);

  async function exportFile(format: "pdf" | "xlsx") {
    if (!token) return;
    setExportBusy(true);
    try {
      const qs = new URLSearchParams({ dateFrom: from, dateTo: to, ledgerType, format });
      if (accountCode.trim()) qs.set("accountCode", accountCode.trim());
      const res = await apiFetch(`/api/reporting/general-ledger/export?${qs.toString()}`);
      if (!res.ok) {
        setErr(`${t("reporting.exportErr")}: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `general-ledger-${from}-${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  }

  if (!ready || !ledgerReady) {
    return <div className="text-gray-600"><p>{t("common.loading")}</p></div>;
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.journal.title")}
        subtitle={
          <p className="m-0">
            <Link href="/reporting" className="text-action hover:text-primary">
              {t("reporting.title")}
            </Link>
            {" · "}
            {t("reporting.activeLedger", { ledger: ledgerType })}
          </p>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.from")}
          <input type="date" className={MODAL_INPUT_CLASS} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.to")}
          <input type="date" className={MODAL_INPUT_CLASS} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.journal.accountOptional")}
          <select className={MODAL_INPUT_CLASS} value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
            <option value="">{t("reporting.journal.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.nameRu || a.nameEn || a.nameAz || a.code}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={loading} onClick={() => void load(0)}>
          {loading ? t("common.loading") : t("reporting.journal.load")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={exportBusy} onClick={() => void exportFile("xlsx")}>
          {t("reporting.exportXlsx")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={exportBusy} onClick={() => void exportFile("pdf")}>
          {t("reporting.exportPdf")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {lines ? (
        lines.length === 0 ? (
          <EmptyState title={t("reporting.journal.empty")} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#34495E]">
              {t("reporting.journal.showing", { shown: lines.length, total })}
            </p>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDate")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thRef")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.thCode")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.thAccName")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDesc")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thCp")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerDr")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerCr")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.journalEntryId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{l.date}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.reference ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.accountCode}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.accountName}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.description ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.counterpartyName ?? "—"}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.debit)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={loading || skip <= 0}
                onClick={() => void load(Math.max(0, skip - take))}
              >
                {t("reporting.journal.prev")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={loading || skip + lines.length >= total}
                onClick={() => void load(skip + take)}
              >
                {t("reporting.journal.next")}
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
