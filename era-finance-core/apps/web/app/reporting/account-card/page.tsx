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
import { SubcontoFilterFields } from "../../../components/reporting/subconto-filter-fields";
import { useSubcontoFilters } from "../../../lib/use-subconto-filters";
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

type AccountOpt = { id: string; code: string; nameRu?: string; nameAz?: string; nameEn?: string };
type CardLine = {
  date: string;
  reference: string | null;
  description: string | null;
  counterpartyName: string | null;
  departmentName: string | null;
  subcontoValueName?: string | null;
  debit: string;
  credit: string;
  balanceDebit: string;
  balanceCredit: string;
};
type CardPayload = {
  account: { code: string; name: string };
  opening: { debit: string; credit: string };
  period: { debit: string; credit: string };
  closing: { debit: string; credit: string };
  lines: CardLine[];
  note?: string;
};
type AnalysisRow = {
  dimensionName: string;
  periodDebit: string;
  periodCredit: string;
  netDebit: string;
  netCredit: string;
};

export default function AccountCardPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const { types, enabled, ready: subcontoReady } = useSubcontoFilters(token);
  const b = monthBounds();
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [dimension, setDimension] = useState<"counterparty" | "department">("counterparty");
  const [subcontoTypeId, setSubcontoTypeId] = useState("");
  const [subcontoValueId, setSubcontoValueId] = useState("");
  const [card, setCard] = useState<CardPayload | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRow[] | null>(null);
  const [tab, setTab] = useState<"card" | "analysis">("card");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState<string | null>(null);

  const useSubcontoCard =
    tab === "card" && subcontoTypeId.trim() !== "" && enabled;

  useEffect(() => {
    if (!token || !ledgerReady) return;
    void (async () => {
      const res = await apiFetch(`/api/accounts?${ledgerQueryParam(ledgerType)}`);
      if (!res.ok) return;
      const rows = (await res.json()) as AccountOpt[];
      setAccounts(rows);
      if (!accountCode && rows[0]) setAccountCode(rows[0].code);
    })();
  }, [token, ledgerReady, ledgerType, accountCode]);

  const load = useCallback(async () => {
    if (!token || !accountCode.trim()) return;
    setLoading(true);
    setErr(null);
    setReportNote(null);
    try {
      if (tab === "card") {
        const base = useSubcontoCard ? "subconto/account-card" : "account-card";
        const qs = new URLSearchParams({
          dateFrom: from,
          dateTo: to,
          accountCode,
          ledgerType,
        });
        if (useSubcontoCard) {
          qs.set("subcontoTypeId", subcontoTypeId);
          if (subcontoValueId.trim()) qs.set("valueId", subcontoValueId.trim());
        }
        const res = await apiFetch(`/api/reporting/${base}?${qs.toString()}`);
        if (!res.ok) {
          setErr(`${t("reporting.accountCard.err")}: ${res.status}`);
          setCard(null);
          return;
        }
        const payload = (await res.json()) as CardPayload & { note?: string | null };
        setCard(payload);
        setReportNote(payload.note ?? null);
        setAnalysis(null);
      } else {
        const path = `/api/reporting/account-analysis?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}&accountCode=${encodeURIComponent(accountCode)}&dimension=${dimension}&${ledgerQueryParam(ledgerType)}`;
        const res = await apiFetch(path);
        if (!res.ok) {
          setErr(`${t("reporting.accountCard.analysisErr")}: ${res.status}`);
          setAnalysis(null);
          return;
        }
        const j = (await res.json()) as { rows: AnalysisRow[] };
        setAnalysis(j.rows);
        setCard(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, accountCode, from, to, ledgerType, tab, dimension, t, useSubcontoCard, subcontoTypeId, subcontoValueId]);

  async function exportFile(format: "pdf" | "xlsx") {
    if (!token || !accountCode.trim()) return;
    setExportBusy(format);
    try {
      const base = tab === "card" ? "account-card" : "account-analysis";
      const qs = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        accountCode,
        ledgerType,
        format,
      });
      if (tab === "analysis") qs.set("dimension", dimension);
      const res = await apiFetch(`/api/reporting/${base}/export?${qs.toString()}`);
      if (!res.ok) {
        setErr(`${t("reporting.exportErr")}: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}-${accountCode}-${from}-${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportBusy(null);
    }
  }

  if (!ready || !ledgerReady) {
    return <div className="text-gray-600"><p>{t("common.loading")}</p></div>;
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.accountCard.title")}
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
          {t("reporting.accountCard.account")}
          <select className={MODAL_INPUT_CLASS} value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.nameRu || a.nameEn || a.nameAz || a.code}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className={tab === "card" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("card")}>
            {t("reporting.accountCard.tabCard")}
          </button>
          <button type="button" className={tab === "analysis" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("analysis")}>
            {t("reporting.accountCard.tabAnalysis")}
          </button>
        </div>
        {tab === "analysis" ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
            {t("reporting.accountCard.dimension")}
            <select className={MODAL_INPUT_CLASS} value={dimension} onChange={(e) => setDimension(e.target.value as "counterparty" | "department")}>
              <option value="counterparty">{t("reporting.accountCard.dimCounterparty")}</option>
              <option value="department">{t("reporting.accountCard.dimDepartment")}</option>
            </select>
          </label>
        ) : null}
        {tab === "card" && subcontoReady ? (
          <SubcontoFilterFields
            types={types}
            enabled={enabled}
            ready={subcontoReady}
            subcontoTypeId={subcontoTypeId}
            valueId={subcontoValueId}
            onSubcontoTypeIdChange={setSubcontoTypeId}
            onValueIdChange={setSubcontoValueId}
          />
        ) : null}
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={loading || !accountCode} onClick={() => void load()}>
          {loading ? t("common.loading") : t("reporting.accountCard.load")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!!exportBusy} onClick={() => void exportFile("xlsx")}>
          {t("reporting.exportXlsx")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={!!exportBusy} onClick={() => void exportFile("pdf")}>
          {t("reporting.exportPdf")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {reportNote ? <p className="text-xs text-[#7F8C8D]">{reportNote}</p> : null}
      {!useSubcontoCard ? (
        <p className="text-xs text-[#7F8C8D]">{t("reporting.accountCard.subcontoNote")}</p>
      ) : null}

      {tab === "card" && card ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-[#34495E]">
            <span>
              <strong>{card.account.code}</strong> {card.account.name}
            </span>
            <span>
              {t("reporting.thOpenDr")}: {formatMoneyAzn(card.opening.debit)} / {t("reporting.thOpenCr")}: {formatMoneyAzn(card.opening.credit)}
            </span>
            <span>
              {t("reporting.thCloseDr")}: {formatMoneyAzn(card.closing.debit)} / {t("reporting.thCloseCr")}: {formatMoneyAzn(card.closing.credit)}
            </span>
          </div>
          {card.lines.length === 0 ? (
            <EmptyState title={t("reporting.accountCard.empty")} />
          ) : (
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDate")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thRef")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDesc")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thCp")}</th>
                    {useSubcontoCard ? (
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.subconto.thValue")}</th>
                    ) : null}
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerDr")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerCr")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thBalDr")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thBalCr")}</th>
                  </tr>
                </thead>
                <tbody>
                  {card.lines.map((l, i) => (
                    <tr key={`${l.date}-${i}`} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{l.date}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.reference ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.description ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{l.counterpartyName ?? "—"}</td>
                      {useSubcontoCard ? (
                        <td className={DATA_TABLE_TD_CLASS}>{l.subcontoValueName ?? "—"}</td>
                      ) : null}
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.debit)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.credit)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.balanceDebit)}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(l.balanceCredit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "analysis" && analysis ? (
        analysis.length === 0 ? (
          <EmptyState title={t("reporting.accountCard.empty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDimension")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerCr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thNetDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thNetCr")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map((r) => (
                  <tr key={r.dimensionName} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.dimensionName}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.periodDebit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.periodCredit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.netDebit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.netCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
