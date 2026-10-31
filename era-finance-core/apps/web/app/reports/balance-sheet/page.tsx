"use client";
import { DatePicker as FinanceDatePicker } from "../../../components/ui/date-picker";

import { todayBakuYmd } from "@era/satellite-kit/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { ledgerQueryParam, useLedger } from "../../../lib/ledger-context";
import { PageHeader } from "../../../components/layout/page-header";
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
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "../../../lib/form-styles";
import { formatMoneyAzn } from "../../../lib/format-money";

type BsLine = { code: string; name: string; amount: string };

type BalanceSheetPayload = {
  asOfDate: string;
  assets: BsLine[];
  liabilities: BsLine[];
  equity: BsLine[];
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    liabilitiesEquity: string;
  };
  cached?: boolean;
};

function fmt(v: unknown): string {
  return formatMoneyAzn(v).replace("₼", "").trim();
}

export default function BalanceSheetPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, accountingBookId, ready: ledgerReady } = useLedger();
  const [asOf, setAsOf] = useState(() => todayBakuYmd());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<BalanceSheetPayload | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setData(null);
    const qs = new URLSearchParams(ledgerQueryParam(ledgerType, accountingBookId));
    qs.set("asOfDate", asOf);
    const res = await apiFetch(`/api/reports/balance-sheet?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setErr(`${t("reports.balanceSheet.err")}: ${res.status}`);
      return;
    }
    setData((await res.json()) as BalanceSheetPayload);
  }, [token, asOf, t, ledgerType, accountingBookId]);

  useEffect(() => {
    if (!ready || !ledgerReady || !token) return;
    void load();
  }, [ready, ledgerReady, token, load]);

  const renderSide = useMemo(
    () =>
      (title: string, rows: BsLine[], total: string) => (
        <div className={CARD_CONTAINER_CLASS}>
          <div className="border-b border-[#D5DADF] bg-[#F8F9FA] px-4 py-3 text-[13px] font-semibold text-[#34495E]">
            {title}
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reports.balanceSheet.thLine")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("reports.balanceSheet.thAmount")} (₼)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <span className="font-medium">{r.name}</span>
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-mono tabular-nums`}>
                      {fmt(r.amount)}
                    </td>
                  </tr>
                ))}
                <tr className={`${DATA_TABLE_TR_CLASS} bg-white`}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>
                    {t("reports.balanceSheet.total")}
                  </td>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-mono tabular-nums font-semibold`}>
                    {fmt(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    [t],
  );

  if (!ready) return <div className="text-gray-600">{t("common.loading")}</div>;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.balanceSheet.title")}
        subtitle={t("reports.balanceSheet.hint")}
        actions={
          <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 p-4`}>
          <label className="flex flex-col gap-1">
            <span className={FORM_LABEL_CLASS}>{t("reports.balanceSheet.asOf")}</span>
            <FinanceDatePicker value={asOf} onChange={(iso) => setAsOf(iso)} respectPeriodLock={false} />
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "…" : t("reports.balanceSheet.load")}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={loading}
            onClick={() => setAsOf(todayBakuYmd())}
          >
            {t("common.today")}
          </button>
        </div>
        }
      />

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      {!data ? null : (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderSide(
            t("reports.balanceSheet.assets"),
            data.assets,
            data.totals.assets,
          )}
          <div className="space-y-4">
            {renderSide(
              t("reports.balanceSheet.liabilities"),
              data.liabilities,
              data.totals.liabilities,
            )}
            {renderSide(
              t("reports.balanceSheet.equity"),
              data.equity,
              data.totals.equity,
            )}
            <div className={`${CARD_CONTAINER_CLASS} p-4 flex items-center justify-between`}>
              <div className="text-sm font-semibold text-[#34495E]">
                {t("reports.balanceSheet.liabilitiesEquity")}
              </div>
              <div className="text-sm font-mono tabular-nums font-semibold text-[#34495E]">
                {fmt(data.totals.liabilitiesEquity)}
                {data.cached ? ` · ${t("reports.cached")}` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

