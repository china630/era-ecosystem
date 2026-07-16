"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useLedger } from "../../../lib/ledger-context";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "../../../lib/form-styles";
import { formatMoneyAzn } from "../../../lib/format-money";

type FormTab = "balance" | "pl" | "cash-flow" | "equity-changes" | "notes";

type MhbsLine = {
  lineCode: string;
  labelAz: string;
  labelEn: string;
  amount: string;
  opening?: string;
  increase?: string;
  decrease?: string;
  closing?: string;
  isTotal?: boolean;
};

type MhbsPayload = {
  form: string;
  ledgerType?: string;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  lines: MhbsLine[];
  totals?: Record<string, string>;
  methodologyNote?: string;
};

const TABS: FormTab[] = ["balance", "pl", "cash-flow", "equity-changes", "notes"];

function monthBounds(): { from: string; to: string; asOf: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${pad(m)}-01`;
  const to = `${y}-${pad(m)}-${pad(last)}`;
  return { from, to, asOf: to };
}

function fmt(v: unknown): string {
  return formatMoneyAzn(v).replace("₼", "").trim();
}

function apiPath(tab: FormTab): string {
  switch (tab) {
    case "balance":
      return "balance";
    case "pl":
      return "pl";
    case "cash-flow":
      return "cash-flow";
    case "equity-changes":
      return "equity-changes";
    case "notes":
      return "notes";
  }
}

export default function MhbsStatementsPage() {
  const { t, i18n } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const b = useMemo(() => monthBounds(), []);

  const [tab, setTab] = useState<FormTab>("balance");
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [asOf, setAsOf] = useState(b.asOf);
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "xlsx">(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<MhbsPayload | null>(null);

  const labelForLine = useCallback(
    (line: MhbsLine) => (i18n.language.startsWith("az") ? line.labelAz : line.labelEn),
    [i18n.language],
  );

  const buildQuery = useCallback(() => {
    const qs = new URLSearchParams({ ledgerType });
    if (tab === "balance" || tab === "notes") {
      qs.set("asOfDate", asOf);
    } else if (tab === "equity-changes") {
      qs.set("year", year);
    } else {
      qs.set("dateFrom", from);
      qs.set("dateTo", to);
    }
    return qs;
  }, [tab, from, to, asOf, year, ledgerType]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setData(null);
    const qs = buildQuery();
    const res = await apiFetch(`/api/reports/statements/${apiPath(tab)}?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setErr(`${t("reports.mhbs.err")}: ${res.status}`);
      return;
    }
    setData((await res.json()) as MhbsPayload);
  }, [token, buildQuery, tab, t]);

  async function exportFile(format: "pdf" | "xlsx") {
    if (!token) return;
    setExporting(format);
    try {
      const qs = buildQuery();
      qs.set("format", format);
      const res = await apiFetch(
        `/api/reports/statements/${apiPath(tab)}/export?${qs.toString()}`,
      );
      if (!res.ok) {
        setErr(`${t("reporting.exportErr", { defaultValue: "Export failed" })}: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mhbs-${tab}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (!ready || !token || !ledgerReady) return;
    void load();
  }, [ready, token, ledgerReady, load, tab, ledgerType]);

  if (!ready || !ledgerReady)
    return <div className="text-gray-600">{t("common.loading")}</div>;
  if (!token) return null;

  const showPeriod = tab === "pl" || tab === "cash-flow";
  const showAsOf = tab === "balance" || tab === "notes";
  const showYear = tab === "equity-changes";
  const equityTable = tab === "equity-changes";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.mhbs.title")}
        subtitle={
          <Fragment>
            <p className="m-0">{t("reports.mhbs.hint")}</p>
            <p className="m-0 text-[12px]">{t("reporting.activeLedger", { ledger: ledgerType })}</p>
          </Fragment>
        }
        leading={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    tab === key
                      ? PRIMARY_BUTTON_CLASS
                      : SECONDARY_BUTTON_CLASS
                  }
                  onClick={() => setTab(key)}
                >
                  {t(`reports.mhbs.tab.${key}`)}
                </button>
              ))}
            </div>
            <div className="flex max-w-4xl flex-wrap items-end gap-3">
              {showPeriod ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className={FORM_LABEL_CLASS}>{t("reports.mhbs.dateFrom")}</span>
                    <input
                      type="date"
                      className={FORM_INPUT_CLASS}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={FORM_LABEL_CLASS}>{t("reports.mhbs.dateTo")}</span>
                    <input
                      type="date"
                      className={FORM_INPUT_CLASS}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {showAsOf ? (
                <label className="flex flex-col gap-1">
                  <span className={FORM_LABEL_CLASS}>{t("reports.mhbs.asOf")}</span>
                  <input
                    type="date"
                    className={FORM_INPUT_CLASS}
                    value={asOf}
                    onChange={(e) => setAsOf(e.target.value)}
                  />
                </label>
              ) : null}
              {showYear ? (
                <label className="flex flex-col gap-1">
                  <span className={FORM_LABEL_CLASS}>{t("reports.mhbs.year")}</span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    className={FORM_INPUT_CLASS}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-end justify-end gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? "…" : t("reports.mhbs.load")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={Boolean(exporting)}
              onClick={() => void exportFile("pdf")}
            >
              {exporting === "pdf"
                ? "…"
                : t("reporting.exportPdf", { defaultValue: "Экспорт PDF" })}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={Boolean(exporting)}
              onClick={() => void exportFile("xlsx")}
            >
              {exporting === "xlsx"
                ? "…"
                : t("reporting.exportXlsx", { defaultValue: "Экспорт XLSX" })}
            </button>
          </div>
        }
      />

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      {data?.methodologyNote ? (
        <p className="text-[12px] text-[#7F8C8D] max-w-4xl leading-snug">{data.methodologyNote}</p>
      ) : null}

      {!data ? null : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#EBEDF0] bg-[#F8F9FA]">
                <th className="p-2 text-left text-[13px] font-semibold text-[#34495E]">
                  {t("reports.mhbs.thLineCode")}
                </th>
                <th className="p-2 text-left text-[13px] font-semibold text-[#34495E]">
                  {t("reports.mhbs.thLine")}
                </th>
                {equityTable ? (
                  <>
                    <th className="p-2 text-right text-[13px] font-semibold text-[#34495E] tabular-nums">
                      {t("reports.mhbs.thOpening")}
                    </th>
                    <th className="p-2 text-right text-[13px] font-semibold text-[#34495E] tabular-nums">
                      {t("reports.mhbs.thIncrease")}
                    </th>
                    <th className="p-2 text-right text-[13px] font-semibold text-[#34495E] tabular-nums">
                      {t("reports.mhbs.thDecrease")}
                    </th>
                    <th className="p-2 text-right text-[13px] font-semibold text-[#34495E] tabular-nums">
                      {t("reports.mhbs.thClosing")}
                    </th>
                  </>
                ) : (
                  <th className="p-2 text-right text-[13px] font-semibold text-[#34495E] tabular-nums">
                    {t("reports.mhbs.thAmount")} (₼)
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr>
                  <td className="p-3 text-sm text-[#7F8C8D]" colSpan={equityTable ? 6 : 3}>
                    —
                  </td>
                </tr>
              ) : (
                data.lines.map((line) => (
                  <tr
                    key={line.lineCode}
                    className={`border-t border-[#EBEDF0] ${line.isTotal ? "bg-[#F8F9FA] font-semibold" : ""}`}
                  >
                    <td className="p-2 font-mono text-[#34495E]">{line.lineCode}</td>
                    <td className="p-2 text-[#34495E]">{labelForLine(line)}</td>
                    {equityTable ? (
                      <>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {fmt(line.opening ?? 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {fmt(line.increase ?? 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {fmt(line.decrease ?? 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {fmt(line.closing ?? line.amount)}
                        </td>
                      </>
                    ) : (
                      <td className="p-2 text-right font-mono tabular-nums">{fmt(line.amount)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
