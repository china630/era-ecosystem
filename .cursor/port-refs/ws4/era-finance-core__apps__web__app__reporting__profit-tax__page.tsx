"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
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
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";

type AdjustmentKind = "PERMANENT" | "TEMPORARY";
type AdjustmentSource = "MANUAL" | "AUTO_TAX_DEPRECIATION";

type AdjustmentRow = {
  id: string;
  kind: AdjustmentKind;
  code: string;
  description: string;
  amount: string;
  source: AdjustmentSource;
};

type ProfitTaxPreview = {
  year: number;
  accountingResult: string;
  adjustmentsTotal: string;
  taxableBase: string;
  taxRatePercent: string;
  taxAmount: string;
  bookDepreciationTotal: string;
  taxDepreciationTotal: string;
  adjustments: AdjustmentRow[];
};

function parseApiErrorBody(data: unknown): string {
  if (!data || typeof data !== "object") return "Error";
  const payload = data as Record<string, unknown>;
  const m = payload.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join("; ");
  try {
    return JSON.stringify(payload).slice(0, 400);
  } catch {
    return "Error";
  }
}

export default function ProfitTaxPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear() - 1);
  const [preview, setPreview] = useState<ProfitTaxPreview | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formKind, setFormKind] = useState<AdjustmentKind>("PERMANENT");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [previewRes, adjRes] = await Promise.all([
        apiFetch(`/api/reporting/profit-tax/preview?year=${year}`),
        apiFetch(`/api/reporting/profit-tax/adjustments?year=${year}`),
      ]);
      const previewBody = (await previewRes.json()) as unknown;
      const adjBody = (await adjRes.json()) as unknown;
      if (!previewRes.ok) {
        setErr(parseApiErrorBody(previewBody));
        setPreview(null);
        setAdjustments([]);
        setLoading(false);
        return;
      }
      if (!adjRes.ok) {
        setErr(parseApiErrorBody(adjBody));
      }
      setPreview(previewBody as ProfitTaxPreview);
      setAdjustments(Array.isArray(adjBody) ? (adjBody as AdjustmentRow[]) : []);
    } catch {
      setErr(t("reporting.profitTax.loadErr"));
      setPreview(null);
      setAdjustments([]);
    }
    setLoading(false);
  }, [token, year, t]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, load]);

  async function createAdjustment() {
    if (!formCode.trim() || !formDescription.trim() || !formAmount.trim()) {
      setErr(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/reporting/profit-tax/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          kind: formKind,
          code: formCode.trim(),
          description: formDescription.trim(),
          amount: formAmount.trim(),
        }),
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        setErr(parseApiErrorBody(data));
        setBusy(false);
        return;
      }
      setModalOpen(false);
      setFormCode("");
      setFormDescription("");
      setFormAmount("");
      await load();
    } catch {
      setErr(t("reporting.profitTax.saveErr"));
    }
    setBusy(false);
  }

  async function deleteAdjustment(id: string) {
    if (!window.confirm(t("reporting.profitTax.confirmDelete"))) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/reporting/profit-tax/adjustments/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        setErr(parseApiErrorBody(data));
        setBusy(false);
        return;
      }
      await load();
    } catch {
      setErr(t("reporting.profitTax.saveErr"));
    }
    setBusy(false);
  }

  if (!ready) {
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
        title={t("reporting.profitTax.title")}
        subtitle={
          <p className="m-0">
            <Link href="/reporting" className="text-action hover:text-primary">
              {t("reporting.title")}
            </Link>
            {" ┬╖ "}
            <Link href="/reporting/tax-export" className="text-action hover:text-primary">
              {t("reporting.taxExportLink")}
            </Link>
          </p>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.profitTax.year")}
          <input
            type="number"
            className={MODAL_INPUT_CLASS}
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={loading} onClick={() => void load()}>
          {loading ? t("common.loading") : t("reporting.profitTax.load")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
          {t("reporting.profitTax.addAdjustment")}
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {preview ? (
        <div className="rounded-xl border border-[#D5DADF] bg-white p-4 text-sm text-[#34495E]">
          <p className="font-semibold m-0 mb-2">{t("reporting.profitTax.summaryTitle")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <span>
              {t("reporting.profitTax.accountingResult")}: {formatMoneyAzn(preview.accountingResult)}
            </span>
            <span>
              {t("reporting.profitTax.adjustmentsTotal")}: {formatMoneyAzn(preview.adjustmentsTotal)}
            </span>
            <span>
              {t("reporting.profitTax.taxableBase")}: {formatMoneyAzn(preview.taxableBase)}
            </span>
            <span>
              {t("reporting.profitTax.taxRate")}: {preview.taxRatePercent}%
            </span>
            <span className="font-semibold">
              {t("reporting.profitTax.taxAmount")}: {formatMoneyAzn(preview.taxAmount)}
            </span>
            <span>
              {t("reporting.profitTax.bookDepreciation")}: {formatMoneyAzn(preview.bookDepreciationTotal)}
            </span>
            <span>
              {t("reporting.profitTax.taxDepreciation")}: {formatMoneyAzn(preview.taxDepreciationTotal)}
            </span>
          </div>
        </div>
      ) : null}

      <section className="bg-white p-6 shadow-sm rounded-xl border border-slate-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("reporting.profitTax.adjustmentsTitle")}
        </h2>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.profitTax.thKind")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.profitTax.thCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.profitTax.thDescription")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.profitTax.thAmount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.profitTax.thSource")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("reporting.taxExportActions")}</th>
              </tr>
            </thead>
            <tbody>
              {(adjustments.length > 0 ? adjustments : preview?.adjustments ?? []).map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.kind}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.description}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(row.amount)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.source === "AUTO_TAX_DEPRECIATION"
                      ? t("reporting.profitTax.sourceAuto")
                      : t("reporting.profitTax.sourceManual")}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.source === "MANUAL" ? (
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("common.delete")}
                        disabled={busy}
                        onClick={() => void deleteAdjustment(row.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                      </button>
                    ) : (
                      "тАФ"
                    )}
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && !(preview?.adjustments?.length) && !loading ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} py-6 text-center text-[#7F8C8D]`} colSpan={6}>
                    {t("reporting.profitTax.adjustmentsEmpty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#2C3E50] m-0 mb-4">
              {t("reporting.profitTax.addAdjustment")}
            </h2>
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
                {t("reporting.profitTax.thKind")}
                <select
                  className={MODAL_INPUT_CLASS}
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as AdjustmentKind)}
                >
                  <option value="PERMANENT">{t("reporting.profitTax.kindPermanent")}</option>
                  <option value="TEMPORARY">{t("reporting.profitTax.kindTemporary")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
                {t("reporting.profitTax.thCode")}
                <input className={MODAL_INPUT_CLASS} value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
                {t("reporting.profitTax.thDescription")}
                <input
                  className={MODAL_INPUT_CLASS}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
                {t("reporting.profitTax.thAmount")}
                <input
                  className={MODAL_INPUT_CLASS}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void createAdjustment()}>
                {busy ? t("common.loading") : t("common.save")}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setModalOpen(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
