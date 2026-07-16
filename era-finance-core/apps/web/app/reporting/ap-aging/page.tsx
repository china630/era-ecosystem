"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { TrendingDown } from "lucide-react";
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

type Row = {
  counterpartyId: string;
  name: string;
  taxId: string;
  bucket0to30: string;
  bucket31to60: string;
  bucket61to90: string;
  bucket90plus: string;
  total: string;
};

type Payload = {
  asOf: string;
  rows: Row[];
  totals: {
    bucket0to30: string;
    bucket31to60: string;
    bucket61to90: string;
    bucket90plus: string;
    total: string;
  };
  methodologyNote?: string;
};

export default function ApAgingPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams();
    if (asOf.trim()) qs.set("asOf", asOf.trim());
    const res = await apiFetch(`/api/reporting/ap-aging?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setErr(`${t("apAging.loadErr")}: ${res.status}`);
      setData(null);
    } else {
      setData((await res.json()) as Payload);
    }
  }, [token, t, asOf]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("apAging.title")}
        subtitle={t("apAging.subtitle")}
        leading={<TrendingDown className="h-6 w-6 text-[#34495E]" />}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          <span>{t("apAging.asOf")}</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className={MODAL_INPUT_CLASS}
          />
        </label>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("apAging.applyAsOf")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading ? <p className="text-gray-600">{t("apAging.loading")}</p> : null}

      {!loading && data ? (
        <>
          {data.methodologyNote ? (
            <p className="text-sm text-[#5D6D7E]">{data.methodologyNote}</p>
          ) : null}
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("apAging.thName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("apAging.thTaxId")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("apAging.th030")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("apAging.th3160")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("apAging.th6190")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("apAging.th90")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("apAging.thTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} py-10 text-center`}>
                      <EmptyState compact title={t("apAging.none")} />
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.counterpartyId} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.name || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.taxId || "—"}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {formatMoneyAzn(row.bucket0to30)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {formatMoneyAzn(row.bucket31to60)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {formatMoneyAzn(row.bucket61to90)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {formatMoneyAzn(row.bucket90plus)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        {formatMoneyAzn(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data.rows.length > 0 ? (
            <p className="text-sm font-medium text-[#34495E]">
              {t("apAging.totals")}: {formatMoneyAzn(data.totals.total)}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
