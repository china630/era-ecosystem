"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
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

type TurnoverRow = {
  accountCode: string;
  accountName: string;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
};

type SubcontoTbRow = TurnoverRow & {
  subcontoTypeCode?: string;
  subcontoTypeName?: string;
  valueName?: string;
};

type ChessCell = {
  debitAccountCode: string;
  creditAccountCode: string;
  amount: string;
};

export default function TurnoversPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const { types, enabled, ready: subcontoReady } = useSubcontoFilters(token);
  const b = monthBounds();
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [tab, setTab] = useState<"turnovers" | "chessboard">("turnovers");
  const [subcontoTypeId, setSubcontoTypeId] = useState("");
  const [rows, setRows] = useState<TurnoverRow[] | SubcontoTbRow[] | null>(null);
  const [reportNote, setReportNote] = useState<string | null>(null);
  const [cells, setCells] = useState<ChessCell[] | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [methodNote, setMethodNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const useSubcontoTb = tab === "turnovers" && subcontoTypeId.trim() !== "" && enabled;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setReportNote(null);
    try {
      if (tab === "turnovers") {
        if (useSubcontoTb) {
          const qs = new URLSearchParams({
            dateFrom: from,
            dateTo: to,
            ledgerType,
            subcontoTypeId,
          });
          const res = await apiFetch(`/api/reporting/subconto/trial-balance?${qs.toString()}`);
          if (!res.ok) {
            setErr(`${t("reporting.turnovers.err")}: ${res.status}`);
            setRows(null);
            return;
          }
          const j = (await res.json()) as {
            rows: SubcontoTbRow[];
            note?: string | null;
            fallback?: { rows: TurnoverRow[] };
          };
          setRows(j.rows.length > 0 ? j.rows : (j.fallback?.rows ?? []));
          setReportNote(j.note ?? null);
        } else {
          const path = `/api/reporting/account-turnovers?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}&${ledgerQueryParam(ledgerType)}`;
          const res = await apiFetch(path);
          if (!res.ok) {
            setErr(`${t("reporting.turnovers.err")}: ${res.status}`);
            setRows(null);
            return;
          }
          const j = (await res.json()) as { rows: TurnoverRow[] };
          setRows(j.rows);
        }
        setCells(null);
      } else {
        const path = `/api/reporting/chessboard?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}&${ledgerQueryParam(ledgerType)}`;
        const res = await apiFetch(path);
        if (!res.ok) {
          setErr(`${t("reporting.chessboard.err")}: ${res.status}`);
          setCells(null);
          return;
        }
        const j = (await res.json()) as {
          cells: ChessCell[];
          accountCodes: string[];
          methodology?: { note?: string };
        };
        setCells(j.cells);
        setCodes(j.accountCodes);
        setMethodNote(j.methodology?.note ?? null);
        setRows(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, from, to, ledgerType, tab, t, useSubcontoTb, subcontoTypeId]);

  async function exportFile(format: "pdf" | "xlsx") {
    if (!token) return;
    setExportBusy(true);
    try {
      const base = tab === "turnovers" ? "account-turnovers" : "chessboard";
      const qs = new URLSearchParams({ dateFrom: from, dateTo: to, ledgerType, format });
      const res = await apiFetch(`/api/reporting/${base}/export?${qs.toString()}`);
      if (!res.ok) {
        setErr(`${t("reporting.exportErr")}: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}-${from}-${to}.${format}`;
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

  const cellMap = new Map(
    (cells ?? []).map((c) => [`${c.debitAccountCode}|${c.creditAccountCode}`, c.amount]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.turnovers.title")}
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
        <div className="flex gap-2">
          <button type="button" className={tab === "turnovers" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("turnovers")}>
            {t("reporting.turnovers.tabTurnovers")}
          </button>
          <button type="button" className={tab === "chessboard" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("chessboard")}>
            {t("reporting.chessboard.tab")}
          </button>
        </div>
        {tab === "turnovers" && subcontoReady ? (
          <SubcontoFilterFields
            types={types}
            enabled={enabled}
            ready={subcontoReady}
            subcontoTypeId={subcontoTypeId}
            valueId=""
            onSubcontoTypeIdChange={setSubcontoTypeId}
            onValueIdChange={() => {}}
            showValueFilter={false}
          />
        ) : null}
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={loading} onClick={() => void load()}>
          {loading ? t("common.loading") : t("reporting.turnovers.load")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={exportBusy} onClick={() => void exportFile("xlsx")}>
          {t("reporting.exportXlsx")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={exportBusy} onClick={() => void exportFile("pdf")}>
          {t("reporting.exportPdf")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {reportNote ? <p className="text-xs text-[#7F8C8D]">{reportNote}</p> : null}

      {tab === "turnovers" && rows ? (
        rows.length === 0 ? (
          <EmptyState title={t("reporting.turnovers.empty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.thCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.thAccName")}</th>
                  {useSubcontoTb ? (
                    <>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.subconto.thType")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.subconto.thValue")}</th>
                    </>
                  ) : null}
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thOpenDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thOpenCr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerCr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thCloseDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thCloseCr")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sub = r as SubcontoTbRow;
                  const rowKey = useSubcontoTb
                    ? `${r.accountCode}-${sub.valueName ?? ""}`
                    : r.accountCode;
                  return (
                  <tr key={rowKey} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.accountCode}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.accountName}</td>
                    {useSubcontoTb ? (
                      <>
                        <td className={DATA_TABLE_TD_CLASS}>{sub.subcontoTypeName ?? "—"}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{sub.valueName ?? "—"}</td>
                      </>
                    ) : null}
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.openingDebit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.openingCredit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.periodDebit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.periodCredit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.closingDebit)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.closingCredit)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "chessboard" && cells ? (
        <div className="space-y-3">
          {methodNote ? <p className="text-xs text-[#7F8C8D]">{methodNote}</p> : null}
          {cells.length === 0 ? (
            <EmptyState title={t("reporting.chessboard.empty")} />
          ) : codes.length <= 20 ? (
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Dt \\ Kt</th>
                    {codes.map((c) => (
                      <th key={c} className={DATA_TABLE_TH_RIGHT_CLASS}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {codes.map((dr) => (
                    <tr key={dr} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{dr}</td>
                      {codes.map((cr) => {
                        const amt = cellMap.get(`${dr}|${cr}`);
                        return (
                          <td key={`${dr}-${cr}`} className={DATA_TABLE_TD_RIGHT_CLASS}>
                            {amt ? formatMoneyAzn(amt) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.chessboard.thDebit")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.chessboard.thCredit")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.chessboard.thAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((c) => (
                    <tr key={`${c.debitAccountCode}-${c.creditAccountCode}`} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{c.debitAccountCode}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{c.creditAccountCode}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
