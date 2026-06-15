"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Account = { id: string; iban?: string };

export default function TransfersPage() {
  const t = useTranslations("transfers");
  const tc = useTranslations("common");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then(async (res) => {
        const data = await res.json();
        const list = Array.isArray(data.accounts) ? data.accounts : data.items ?? [];
        setAccounts(list);
        if (list[0]) setFromAccountId(list[0].id);
        if (list[1]) setToAccountId(list[1].id);
      })
      .catch(() => undefined);
  }, []);

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/transfers/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amountMinor: Math.round(parseFloat(amount) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(t("success"));
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <form onSubmit={submitTransfer} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("from")}</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.iban ?? a.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-dbo-muted">{t("to")}</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.iban ?? a.id}
              </option>
            ))}
          </select>
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-dbo-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t("submit")}
        </button>
      </form>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
