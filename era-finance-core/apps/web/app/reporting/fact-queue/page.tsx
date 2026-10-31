"use client";

import { todayBakuYmd } from "@era/satellite-kit/time";
import { CatalogField } from "@era/satellite-kit/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/api-client";
import { parseApiErrorPayload } from "../../../lib/api-error-text";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_INPUT_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type QueueRow = {
  source: "BANK" | "CASH";
  id: string;
  date: string;
  amount: string;
  direction: "IN" | "OUT";
  label: string;
  counterpartyRole: "CUSTOMER" | "SUPPLIER" | "BOTH" | "OTHER" | null;
  isFounder: boolean;
};

type LinkOption = { id: string; label: string };

type QueuePayload = {
  period: string;
  count: number;
  rows: QueueRow[];
  invoices: LinkOption[];
  purchases: LinkOption[];
};

function meaningsFor(row: QueueRow, confirm: boolean): string[] {
  const direction =
    row.direction === "IN"
      ? ["CUSTOMER_PAYMENT", "FOUNDER_LOAN_IN", "DUPLICATE_OR_ERROR"]
      : [
          "SUPPLIER_PAYMENT",
          "FOUNDER_LOAN_RETURN",
          "OWNER_WITHDRAWAL",
          "BANK_COMMISSION",
          "DUPLICATE_OR_ERROR",
        ];
  return direction.filter((meaning) => {
    if (confirm) return true;
    if (meaning === "SUPPLIER_PAYMENT" && row.isFounder) return false;
    const loan = meaning === "FOUNDER_LOAN_IN" || meaning === "FOUNDER_LOAN_RETURN";
    if (loan && !row.isFounder && (row.counterpartyRole === "SUPPLIER" || row.counterpartyRole === "BOTH")) {
      return false;
    }
    return true;
  });
}

export default function FactQueuePage() {
  const { t } = useTranslation();
  const { token } = useRequireAuth();
  const [period, setPeriod] = useState(() => todayBakuYmd().slice(0, 7));
  const [payload, setPayload] = useState<QueuePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [meaning, setMeaning] = useState<Record<string, string>>({});
  const [invoiceId, setInvoiceId] = useState<Record<string, string>>({});
  const [purchaseId, setPurchaseId] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("period");
    if (fromQuery && /^\d{4}-(0[1-9]|1[0-2])$/.test(fromQuery)) setPeriod(fromQuery);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const res = await apiFetch(`/api/reporting/fact-queue?period=${encodeURIComponent(period)}`);
    if (!res.ok) {
      const parsed = parseApiErrorPayload(await res.text());
      setErr(parsed.message || t("reporting.factQueueErr"));
      setPayload(null);
      return;
    }
    setPayload((await res.json()) as QueuePayload);
  }, [period, t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(row: QueueRow) {
    const chosen = meaning[row.id];
    if (!chosen) return;
    setBusy(row.id);
    setErr(null);
    const res = await apiFetch("/api/reporting/fact-queue/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: row.source,
        id: row.id,
        meaning: chosen,
        invoiceId: chosen === "CUSTOMER_PAYMENT" ? invoiceId[row.id] : undefined,
        purchaseTransactionId: chosen === "SUPPLIER_PAYMENT" ? purchaseId[row.id] : undefined,
        confirmMismatch: confirm[row.id] === true,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const parsed = parseApiErrorPayload(await res.text());
      setErr(
        parsed.code === "FACT_MEANING_MISMATCH"
          ? t("reporting.factQueueMismatch")
          : parsed.message || t("reporting.factQueueErr"),
      );
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("reporting.factQueueTitle")}
        subtitle={t("reporting.factQueueHint")}
        leading={
          <label className="flex flex-col gap-1 text-[13px] text-[#34495E]">
            {t("reporting.factQueuePeriod")}
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className={`${MODAL_INPUT_CLASS} w-40`}
            />
          </label>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#7F8C8D]">
            <Link href="/reporting" className="underline text-[#34495E]">
              {t("reporting.closePeriodBtn")}
            </Link>
            {payload ? <span>{t("reporting.factQueueCount", { count: payload.count })}</span> : null}
          </div>
        }
      />
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {payload && payload.rows.length === 0 ? (
        <EmptyState title={t("reporting.factQueueEmpty")} />
      ) : null}
      {(payload?.rows ?? []).length > 0 ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.factQueuePeriod")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.factQueueBank")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("invoices.amount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.factQueueMeaning")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {(payload?.rows ?? []).map((row) => {
                const allowed = meaningsFor(row, confirm[row.id] === true);
                const chosen = meaning[row.id] ?? "";
                return (
                  <tr key={`${row.source}:${row.id}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="space-y-1">
                        <div>{row.date}</div>
                        <div className="text-[12px] text-[#7F8C8D]">{row.label}</div>
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.source === "BANK"
                        ? t("reporting.factQueueBank")
                        : t("reporting.factQueueCash")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.amount}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="min-w-[14rem] space-y-2 py-1">
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t("reporting.factQueueMeaning")}
                          value={chosen}
                          onChange={(next) => {
                            const value = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                            setMeaning((prev) => ({ ...prev, [row.id]: value }));
                          }}
                          options={allowed.map((code) => ({
                            value: code,
                            label: t(`reporting.factMeaning.${code}`),
                          }))}
                        />
                        {chosen === "CUSTOMER_PAYMENT" ? (
                          <CatalogField
                            kind="SEARCHABLE"
                            label={t("reporting.factQueueInvoice")}
                            value={invoiceId[row.id] ?? ""}
                            onChange={(next) => {
                              const value = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                              setInvoiceId((prev) => ({ ...prev, [row.id]: value }));
                            }}
                            options={(payload?.invoices ?? []).map((item) => ({
                              value: item.id,
                              label: item.label,
                            }))}
                          />
                        ) : null}
                        {chosen === "SUPPLIER_PAYMENT" ? (
                          <CatalogField
                            kind="SEARCHABLE"
                            label={t("reporting.factQueuePurchase")}
                            value={purchaseId[row.id] ?? ""}
                            onChange={(next) => {
                              const value = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                              setPurchaseId((prev) => ({ ...prev, [row.id]: value }));
                            }}
                            options={(payload?.purchases ?? []).map((item) => ({
                              value: item.id,
                              label: item.label,
                            }))}
                          />
                        ) : null}
                        <label className="flex items-center gap-2 text-[12px] text-[#34495E]">
                          <input
                            type="checkbox"
                            className={MODAL_CHECKBOX_CLASS}
                            checked={confirm[row.id] === true}
                            onChange={(event) =>
                              setConfirm((prev) => ({ ...prev, [row.id]: event.target.checked }))
                            }
                          />
                          {t("reporting.factQueueConfirm")}
                        </label>
                      </div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          busy === row.id ||
                          !chosen ||
                          (chosen === "CUSTOMER_PAYMENT" && !invoiceId[row.id]) ||
                          (chosen === "SUPPLIER_PAYMENT" && !purchaseId[row.id])
                        }
                        onClick={() => void save(row)}
                      >
                        {t("reporting.factQueueSave")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
