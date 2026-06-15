"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  FxEquivalentBadge,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  VoenLookupField,
} from "@era/satellite-kit/ui";

type ImportOrder = {
  id: string;
  externalRef: string;
  currencyCode: string;
  amountForeign: string | number;
  paymentTermDays: number;
  dueDate?: string | null;
  status: string;
  supplierVoen?: string | null;
};

export default function ImportOrdersAdminPage() {
  const t = useTranslations("importOrders");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<ImportOrder[]>([]);
  const [externalRef, setExternalRef] = useState("");
  const [supplierVoen, setSupplierVoen] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [amountForeign, setAmountForeign] = useState("1000");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [duePreview, setDuePreview] = useState<string | null>(null);
  const [sku, setSku] = useState("IMP-SKU-001");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/import-orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : data.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const from = new Date().toISOString().slice(0, 10);
    const days = Number(paymentTermDays) || 0;
    void fetch(`/api/payment-terms/due-date?from=${from}&days=${days}`)
      .then((r) => r.json())
      .then((d) => setDuePreview(d.dueDate ?? null))
      .catch(() => setDuePreview(null));
  }, [paymentTermDays]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/import-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalRef: externalRef || `WS-IMP-${Date.now()}`,
          supplierVoen: supplierVoen || undefined,
          currencyCode,
          amountForeign: Number(amountForeign),
          paymentTermDays: Number(paymentTermDays),
          lines: [{ sku, quantity: 1, unitPriceForeign: Number(amountForeign) }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setMessage(t("created"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/import-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      setMessage(t("confirmed"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-6 p-6`}>
        {message ? <p className="text-[13px]">{message}</p> : null}
        <form onSubmit={createOrder} className={FORM_STACK_CLASS}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("externalRef")}</label>
              <input className={MODAL_INPUT_CLASS} value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="WS-PO-001" />
            </div>
            <VoenLookupField
              value={supplierVoen}
              onChange={setSupplierVoen}
              labels={{
                voen: t("supplierVoen"),
                check: tc("check"),
                found: t("voenFound"),
                notFound: t("voenNotFound"),
                invalid: t("voenInvalid"),
              }}
            />
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("currency")}</label>
              <input className={MODAL_INPUT_CLASS} value={currencyCode} maxLength={3} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} />
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("amount")}</label>
              <input className={MODAL_INPUT_CLASS} value={amountForeign} onChange={(e) => setAmountForeign(e.target.value)} inputMode="decimal" />
              {currencyCode !== "AZN" ? (
                <FxEquivalentBadge amount={Number(amountForeign) || 0} currencyCode={currencyCode} className="mt-1 block" />
              ) : null}
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>{t("paymentTerms")}</label>
              <input className={MODAL_INPUT_CLASS} value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)} inputMode="numeric" />
              {duePreview ? <p className="mt-1 text-xs text-[#7F8C8D]">{t("dueDate")}: {duePreview}</p> : null}
            </div>
            <div className={FORM_FIELD_GROUP_CLASS}>
              <label className={MODAL_FIELD_LABEL_CLASS}>SKU</label>
              <input className={MODAL_INPUT_CLASS} value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          </div>
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>{t("create")}</button>
        </form>

        <div>
          <h2 className="mb-2 text-sm font-semibold">{t("list")}</h2>
          <ul className="space-y-2 text-[13px]">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                <span>
                  {o.externalRef} — {Number(o.amountForeign).toFixed(2)} {o.currencyCode}
                  {o.dueDate ? ` · ${t("dueDate")} ${String(o.dueDate).slice(0, 10)}` : ""}
                  {" · "}{o.status}
                </span>
                {o.status === "DRAFT" ? (
                  <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void confirmOrder(o.id)}>
                    {t("confirmFinance")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <Link href="/orders" className={SECONDARY_BUTTON_CLASS}>{t("backOrders")}</Link>
      </div>
    </>
  );
}
