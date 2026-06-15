"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Account = { id: string; iban?: string };

export default function NewPaymentPage() {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debitAccountId, setDebitAccountId] = useState("");
  const [beneficiaryIban, setBeneficiaryIban] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then(async (res) => {
        const data = await res.json();
        const list = Array.isArray(data.accounts) ? data.accounts : data.items ?? [];
        setAccounts(list);
        if (list[0]) setDebitAccountId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debitAccountId,
          beneficiaryIban,
          beneficiaryName,
          purpose,
          amountMinor: Math.round(parseFloat(amount) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const id = data.order?.id ?? data.id;
      setOrderId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  async function signAndSubmit() {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const signRes = await fetch(`/api/payments/orders/${orderId}/sign`, { method: "POST" });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);

      const submitRes = await fetch(`/api/payments/orders/${orderId}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": `submit-${orderId}` },
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error);
      window.location.href = "/payments";
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/payments" className="text-sm text-dbo-primary">
        ← {tc("back")}
      </Link>
      <h1 className="text-lg font-semibold">{t("new")}</h1>
      <form onSubmit={createOrder} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("beneficiary")}</label>
          <input
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={beneficiaryIban}
            onChange={(e) => setBeneficiaryIban(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("beneficiaryName")}</label>
          <input
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={beneficiaryName}
            onChange={(e) => setBeneficiaryName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("purpose")}</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("amount")}</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <input type="hidden" value={debitAccountId} readOnly />
        {!orderId ? (
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-dbo-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("create")}
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={signAndSubmit}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("submit")}
          </button>
        )}
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
