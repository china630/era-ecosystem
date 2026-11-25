"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  showApiError,
} from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";

type InsuranceReportItem = {
  visitId: string;
  payerKind: string | null;
  amountNet: number;
  patientRefCode: string;
  patientName: string;
  referralCode: string | null;
  at: string;
};

export default function InsuranceReportPage() {
  const t = useTranslations("insuranceReport");
  const [from, setFrom] = useState(addBakuDays(todayBakuYmd(), -30));
  const [to, setTo] = useState(todayBakuYmd());
  const [items, setItems] = useState<InsuranceReportItem[]>([]);
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    return `/api/reports/insurance?${params.toString()}`;
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as { items?: InsuranceReportItem[]; error?: string };
        if (!res.ok) {
          showApiError(body, t("loadFailed"));
          return;
        }
        if (!cancelled) setItems(body.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, t]);

  return (
    <EraListWorkspace className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-wrap gap-3">
        <DatePicker label={t("from")} value={from} onChange={setFrom} />
        <DatePicker label={t("to")} value={to} onChange={setTo} />
      </div>
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPayer")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colReferral")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.visitId} className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS}>
                {row.patientName}
                <span className="ml-1 text-slate-500">({row.patientRefCode})</span>
              </td>
              <td className={DATA_TABLE_TD_CLASS}>{row.payerKind ?? "—"}</td>
              <td className={DATA_TABLE_TD_CLASS}>{row.referralCode ?? "—"}</td>
              <td className={DATA_TABLE_TD_CLASS}>{row.amountNet.toFixed(2)}</td>
            </tr>
          ))}
          {!busy && items.length === 0 ? (
            <tr>
              <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} text-slate-500`}>
                {t("empty")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </EraListWorkspace>
  );
}