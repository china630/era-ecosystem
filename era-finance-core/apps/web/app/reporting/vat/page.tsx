"use client";

import { CatalogField } from "@era/satellite-kit/ui";
import { bakuCalendarYear } from "@era/satellite-kit/time";
import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type VatLine = {
  lineNo: number;
  btp: {
    tarixi: string;
    sened_nomresi: string;
    alici_ad?: string;
    alici_voen?: string;
    satıcı_ad?: string;
    satıcı_voen?: string;
    tesvir: string;
    mebleg_edvsiz: string;
    edv_meblegi: string;
    cemi: string;
  };
};

type VatPackage = {
  package: {
    appendixSales: VatLine[];
    appendixPurchases: VatLine[];
    totals: {
      outputVat: string;
      inputVat: string;
      vatPayable: string;
      salesNet: string;
      purchasesNet: string;
    };
    reportingPeriod: { year: number; quarter: number; dateFrom: string; dateTo: string };
  };
  validation: {
    errors: Array<{ code: string; message: string }>;
    readyToSubmit: boolean;
  };
};

export default function VatDeclarationPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const now = new Date();
  const [year, setYear] = useState(() => bakuCalendarYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getUTCMonth() / 3) + 1);
  const [tab, setTab] = useState<"sales" | "purchases">("sales");
  const [data, setData] = useState<VatPackage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setSubmitMsg(null);
    try {
      const res = await apiFetch(
        `/api/reporting/etaxes-vat-declaration?year=${year}&quarter=${quarter}`,
      );
      if (!res.ok) {
        const text = await res.text();
        setErr(`${t("reporting.vat.loadErr")}: ${res.status} ${text.slice(0, 200)}`);
        setData(null);
        return;
      }
      setData((await res.json()) as VatPackage);
    } finally {
      setLoading(false);
    }
  }, [token, year, quarter, t]);

  async function downloadXlsx() {
    if (!token) return;
    const res = await apiFetch(
      `/api/reporting/vat-appendix-xlsx?year=${year}&quarter=${quarter}`,
    );
    if (!res.ok) {
      setErr(`${t("reporting.exportErr")}: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-appendix-${year}-Q${quarter}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!token || !data?.validation.readyToSubmit) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await apiFetch(
        `/api/reporting/etaxes-vat-declaration/submit?year=${year}&quarter=${quarter}`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitMsg(
          typeof body === "object" && body && "message" in body
            ? String((body as { message: unknown }).message)
            : `${t("reporting.taxExportEtaxesErrGateway")} (${res.status})`,
        );
        return;
      }
      setSubmitMsg(
        t("reporting.vat.submitOk", {
          status: String((body as { gatewayStatus?: number }).gatewayStatus ?? res.status),
        }),
      );
      // Persist VAT declaration in tax-export workflow
      await apiFetch("/api/reporting/tax-declarations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxType: "VAT", period: `${year}-Q${quarter}` }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="text-gray-600"><p>{t("common.loading")}</p></div>;
  }
  if (!token) return null;

  const rows =
    tab === "sales"
      ? data?.package.appendixSales ?? []
      : data?.package.appendixPurchases ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reporting.vat.title")}
        subtitle={
          <p className="m-0">
            <Link href="/reporting" className="text-action hover:text-primary">
              {t("reporting.title")}
            </Link>
            {" · "}
            <Link href="/reporting/tax-export" className="text-action hover:text-primary">
              {t("reporting.taxExportLink")}
            </Link>
          </p>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.vat.year")}
          <input
            type="number"
            className={MODAL_INPUT_CLASS}
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("reporting.vat.quarter")}
          value={String(quarter)}
          onChange={(next) => {
            const v = Array.isArray(next) ? next[0] ?? "1" : String(next ?? "1");
            const n = Number(v);
            if (n >= 1 && n <= 4) setQuarter(n);
          }}
          options={[
            { value: "1", label: "Q1" },
            { value: "2", label: "Q2" },
            { value: "3", label: "Q3" },
            { value: "4", label: "Q4" },
          ]}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={loading} onClick={() => void load()}>
          {loading ? t("common.loading") : t("reporting.vat.load")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void downloadXlsx()}>
          {t("reporting.vat.downloadXlsx")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!data}
          onClick={() => setShowPreview(true)}
        >
          {t("reporting.vat.previewSubmit")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {data ? (
        <div className="rounded-xl border border-[#D5DADF] bg-white p-4 text-sm text-[#34495E]">
          <p className="font-semibold m-0 mb-2">{t("reporting.vat.totalsTitle")}</p>
          <div className="flex flex-wrap gap-4">
            <span>
              {t("reporting.vat.outputVat")}: {formatMoneyAzn(data.package.totals.outputVat)}
            </span>
            <span>
              {t("reporting.vat.inputVat")}: {formatMoneyAzn(data.package.totals.inputVat)}
            </span>
            <span>
              {t("reporting.vat.payableVat")}: {formatMoneyAzn(data.package.totals.vatPayable)}
            </span>
            <Badge variant={data.validation.readyToSubmit ? "success" : "neutral"}>
              {data.validation.readyToSubmit
                ? t("reporting.vat.readyYes")
                : `${t("reporting.vat.readyNo")} (${data.validation.errors.length})`}
            </Badge>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className={tab === "sales" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("sales")}>
          {t("reporting.vat.tabSales")}
          {data ? ` (${data.package.appendixSales.length})` : ""}
        </button>
        <button type="button" className={tab === "purchases" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab("purchases")}>
          {t("reporting.vat.tabPurchases")}
          {data ? ` (${data.package.appendixPurchases.length})` : ""}
        </button>
      </div>

      {data ? (
        rows.length === 0 ? (
          <EmptyState title={t("reporting.vat.empty")} />
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vat.thDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vat.thDoc")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vat.thCp")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.vat.thVoen")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.accountCard.thDesc")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.vat.thNet")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.vat.thVat")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.vat.thGross")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${tab}-${r.lineNo}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.btp.tarixi}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.btp.sened_nomresi}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {tab === "sales" ? r.btp.alici_ad : r.btp.satıcı_ad}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {tab === "sales" ? r.btp.alici_voen : r.btp.satıcı_voen}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.btp.tesvir}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.btp.mebleg_edvsiz)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.btp.edv_meblegi)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.btp.cemi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {showPreview && data ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
        >
          <div
            className={`${MODAL_DIALOG_CONTENT_CLASS} max-h-[min(90vh,48rem)] w-full max-w-2xl`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vat-preview-title"
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h2 id="vat-preview-title" className="m-0 text-lg font-semibold text-[#34495E]">
                {t("reporting.taxExportEtaxesModalTitle")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setShowPreview(false)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              <p className="m-0 text-sm text-[#34495E]">
                {t("reporting.taxExportEtaxesSummary", {
                  sales: data.package.appendixSales.length,
                  purchases: data.package.appendixPurchases.length,
                  ready: data.validation.readyToSubmit
                    ? t("reporting.vat.readyYes")
                    : t("reporting.vat.readyNo"),
                })}
              </p>
              <div className="rounded-lg bg-[#F4F5F7] p-3 text-sm">
                <p className="font-medium m-0 mb-1">{t("reporting.vat.totalsTitle")}</p>
                <p className="m-0">
                  {t("reporting.vat.outputVat")}: {formatMoneyAzn(data.package.totals.outputVat)}
                </p>
                <p className="m-0">
                  {t("reporting.vat.inputVat")}: {formatMoneyAzn(data.package.totals.inputVat)}
                </p>
                <p className="m-0">
                  {t("reporting.vat.payableVat")}: {formatMoneyAzn(data.package.totals.vatPayable)}
                </p>
              </div>
              {data.validation.errors.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-red-700 m-0 mb-1">
                    {t("reporting.taxExportEtaxesValidationTitle")}
                  </p>
                  <ul className="text-xs text-red-600 max-h-40 overflow-auto pl-4">
                    {data.validation.errors.map((e, i) => (
                      <li key={`${e.code}-${i}`}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {submitMsg ? <p className="m-0 text-sm text-[#34495E]">{submitMsg}</p> : null}
            </div>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setShowPreview(false)}
              >
                {t("reporting.vat.close")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={!data.validation.readyToSubmit || submitting}
                onClick={() => void submit()}
              >
                {submitting ? t("common.loading") : t("reporting.vat.submit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
