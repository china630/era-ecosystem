"use client";

import { todayBakuYmd } from "@era/satellite-kit/time";
import { CatalogField } from "@era/satellite-kit/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { parseApiErrorPayload } from "../../../lib/api-error-text";
import { PRIMARY_BUTTON_CLASS } from "../../../lib/design-system";
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
  const direction = row.direction === "IN"
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
      <PageHeader title={t("reporting.factQueueTitle")} description={t("reporting.factQueueHint")} />
      <label className="flex flex-col gap-1 text-sm text-[#34495E]">
        {t("reporting.factQueuePeriod")}
        <input
          type="month"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          className="w-40 rounded border border-[#D5DADF] px-2 py-1"
        />
      </label>
      <p className="text-sm text-[#34495E]">
        <Link href="/reporting" className="underline">
          {t("reporting.closePeriodBtn")}
        </Link>
        {payload ? ` · ${t("reporting.factQueueCount", { count: payload.count })}` : null}
      </p>
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {payload && payload.rows.length === 0 ? (
        <p className="text-sm text-[#34495E]">{t("reporting.factQueueEmpty")}</p>
      ) : null}
      <ul className="space-y-3">
        {(payload?.rows ?? []).map((row) => {
          const allowed = meaningsFor(row, confirm[row.id] === true);
          const chosen = meaning[row.id] ?? "";
          return (
            <li key={`${row.source}:${row.id}`} className="rounded border border-[#D5DADF] p-3 space-y-2">
              <p className="text-sm text-[#34495E]">
                {row.date} · {row.label} · {row.amount} · {row.source === "BANK" ? t("reporting.factQueueBank") : t("reporting.factQueueCash")}
              </p>
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
                  options={(payload?.invoices ?? []).map((item) => ({ value: item.id, label: item.label }))}
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
                  options={(payload?.purchases ?? []).map((item) => ({ value: item.id, label: item.label }))}
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm text-[#34495E]">
                <input
                  type="checkbox"
                  checked={confirm[row.id] === true}
                  onChange={(event) =>
                    setConfirm((prev) => ({ ...prev, [row.id]: event.target.checked }))
                  }
                />
                {t("reporting.factQueueConfirm")}
              </label>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={
                  busy === row.id ||
                  !chosen ||
                  (chosen === "CUSTOMER_PAYMENT" && !invoiceId[row.id]) ||
                  (chosen === "SUPPLIER_PAYMENT" && !purchaseId[row.id])
                }
                onClick={() => void save(row)}
              >
                {t("reporting.factQueueSave")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
