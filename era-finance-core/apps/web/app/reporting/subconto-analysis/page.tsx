"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { ledgerQueryParam, useLedger } from "../../../lib/ledger-context";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubcontoFilters } from "../../../lib/use-subconto-filters";
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
type AnalysisRow = {
  valueId: string | null;
  valueRef: string | null;
  valueName: string;
  periodDebit: string;
  periodCredit: string;
  netDebit: string;
  netCredit: string;
};

export default function SubcontoAnalysisPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const { types, enabled, ready: subcontoReady } = useSubcontoFilters(token);
  const b = monthBounds();
  const [from, setFrom] = useState(b.from);
  const [to, setTo] = useState(b.to);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [subcontoTypeId, setSubcontoTypeId] = useState("");
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !ledgerReady) return;
    void (async () => {
      const res = await apiFetch(`/api/accounts?${ledgerQueryParam(ledgerType)}`);
      if (!res.ok) return;
      const list = (await res.json()) as AccountOpt[];
      setAccounts(list);
    })();
  }, [token, ledgerReady, ledgerType]);

  useEffect(() => {
    if (subcontoReady && types[0] && !subcontoTypeId) {
      setSubcontoTypeId(types[0].id);
    }
  }, [subcontoReady, types, subcontoTypeId]);

  const load = useCallback(async () => {
    if (!token || !subcontoTypeId.trim()) return;
    setLoading(true);
    setErr(null);
    setNote(null);
    try {
      const qs = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        subcontoTypeId,
        ledgerType,
      });
      if (accountCode.trim()) qs.set("accountCode", accountCode.trim());
      const res = await apiFetch(`/api/reporting/subconto/analysis?${qs.toString()}`);
      if (!res.ok) {
        setErr(`${t("reporting.subconto.analysisErr")}: ${res.status}`);
        setRows(null);
        return;
      }
      const j = (await res.json()) as { rows: AnalysisRow[]; note?: string | null };
      setRows(j.rows);
      setNote(j.note ?? null);
    } finally {
      setLoading(false);
    }
  }, [token, from, to, subcontoTypeId, accountCode, ledgerType, t]);

  if (!ready || !ledgerReady) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.subconto.analysisTitle")}
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
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.to")}
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.subconto.type")}
          <select
            className={MODAL_INPUT_CLASS}
            value={subcontoTypeId}
            onChange={(e) => setSubcontoTypeId(e.target.value)}
          >
            {types.map((st) => (
              <option key={st.id} value={st.id}>
                {st.code} — {st.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.subconto.accountOptional")}
          <select
            className={MODAL_INPUT_CLASS}
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
          >
            <option value="">{t("reporting.subconto.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.nameRu || a.nameEn || a.nameAz || a.code}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={loading || !subcontoTypeId}
          onClick={() => void load()}
        >
          {loading ? t("common.loading") : t("reporting.subconto.load")}
        </button>
      </div>

      {!enabled && subcontoReady ? (
        <p className="text-xs text-[#7F8C8D]">{t("reporting.subconto.disabledNote")}</p>
      ) : null}
      {note ? <p className="text-xs text-[#7F8C8D]">{note}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {rows ? (
        rows.length === 0 ? (
          <EmptyState title={t("reporting.subconto.empty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.subconto.thValue")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.thPerCr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thNetDr")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.accountCard.thNetCr")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.valueId ?? ""}-${r.valueRef ?? ""}-${r.valueName}`}
                    className={DATA_TABLE_TR_CLASS}
                  >
                    <td className={DATA_TABLE_TD_CLASS}>{r.valueName}</td>
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
