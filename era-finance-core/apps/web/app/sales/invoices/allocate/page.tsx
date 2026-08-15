"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../../lib/api-client";
import { formatMoneyAzn } from "../../../../lib/format-money";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { PageHeader } from "../../../../components/layout/page-header";
import { EmptyState } from "../../../../components/empty-state";
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
} from "../../../../lib/design-system";

type Cp = { id: string; name: string; taxId: string; paymentTermsDays?: number | null };
type Inv = {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  totalAmount: unknown;
  paidTotal?: string;
  remaining?: string;
};

export default function InvoiceAllocatePage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [counterparties, setCounterparties] = useState<Cp[]>([]);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const openRows = useMemo(
    () =>
      invoices.filter((r) => {
        const rem = Number(r.remaining ?? 0);
        return rem > 0.0001;
      }),
    [invoices],
  );

  const loadCounterparties = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/counterparties?pageSize=200");
    if (!res.ok) return;
    const data = (await res.json()) as { items?: Cp[] } | Cp[];
    setCounterparties(Array.isArray(data) ? data : (data.items ?? []));
  }, [token]);

  const loadInvoices = useCallback(async () => {
    if (!token || !counterpartyId) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({
      counterpartyId,
      pageSize: "100",
    });
    const res = await apiFetch(`/api/invoices?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(t("invoices.allocateLoadErr", { defaultValue: "Failed to load invoices" }));
      setInvoices([]);
      return;
    }
    const data = (await res.json()) as { items?: Inv[] };
    setInvoices(data.items ?? []);
  }, [token, counterpartyId, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadCounterparties();
  }, [ready, token, loadCounterparties]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadInvoices();
  }, [ready, token, loadInvoices]);

  async function allocate() {
    const amt = Number(amount);
    if (!counterpartyId || !(amt > 0)) {
      toast.error(t("invoices.allocateAmountRequired", { defaultValue: "Enter a positive amount" }));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/invoices/payments/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterpartyId,
        amount: amt,
        paymentDate: paymentDate || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("invoices.allocateErr", { defaultValue: "Allocation failed" }), {
        description: await res.text(),
      });
      return;
    }
    toast.success(
      t("invoices.allocateOk", { defaultValue: "Payment allocated by due date order" }),
    );
    setAmount("");
    await loadInvoices();
  }

  if (!ready) {
    return <p className="text-gray-600">{t("common.loading")}</p>;
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("invoices.allocateTitle", { defaultValue: "Invoice payment matching" })}
        subtitle={t("invoices.allocateSubtitle", {
          defaultValue:
            "Allocate a bank receipt across open counterparty invoices by due date. Hotel City Ledger AR is owned here, not in hotel-pms.",
        })}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          <span>{t("counterparties.title", { defaultValue: "Counterparty" })}</span>
          <select
            className={MODAL_INPUT_CLASS}
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
          >
            <option value="">{t("common.select", { defaultValue: "Select…" })}</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.taxId})
                {c.paymentTermsDays != null ? ` · ${c.paymentTermsDays}d` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          <span>{t("invoices.allocateAmount", { defaultValue: "Amount AZN" })}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={MODAL_INPUT_CLASS}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          <span>{t("invoices.paymentDate", { defaultValue: "Payment date" })}</span>
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !counterpartyId}
          onClick={() => void allocate()}
        >
          {t("invoices.allocateAction", { defaultValue: "Allocate by due date" })}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!counterpartyId || loading}
          onClick={() => void loadInvoices()}
        >
          {t("common.refresh", { defaultValue: "Refresh" })}
        </button>
      </div>

      {loading ? <p className="text-gray-600">{t("common.loading")}</p> : null}
      {!loading && counterpartyId && openRows.length === 0 ? (
        <EmptyState
          title={t("invoices.allocateEmpty", { defaultValue: "No open receivable invoices" })}
        />
      ) : null}
      {!loading && openRows.length > 0 ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("invoices.number", { defaultValue: "Number" })}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("invoices.status", { defaultValue: "Status" })}
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("invoices.dueDate", { defaultValue: "Due" })}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("invoices.remaining", { defaultValue: "Remaining" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {openRows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{r.number}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{String(r.dueDate).slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {formatMoneyAzn(Number(r.remaining ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
