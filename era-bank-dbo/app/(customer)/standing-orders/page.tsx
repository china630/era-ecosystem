"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  amountMinor?: number;
  toIban?: string;
};

export default function StandingOrdersPage() {
  const t = useTranslations("standingOrders");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fromAccountId: "",
    toIban: "",
    amountMinor: "",
    nextRunAt: new Date(Date.now() + 86400000).toISOString(),
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/standing-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(Array.isArray(data) ? data : data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/standing-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        ...form,
        amountMinor: Math.round(Number(form.amountMinor) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setForm((f) => ({ ...f, toIban: "", amountMinor: "" }));
    await load();
  }

  async function pause(id: string) {
    await fetch(`/api/standing-orders/${id}/pause`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <form className="space-y-2 rounded-xl bg-white p-3 shadow-sm" onSubmit={create}>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("fromAccount")}
          value={form.fromAccountId}
          onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("toIban")}
          value={form.toIban}
          onChange={(e) => setForm({ ...form, toIban: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("amount")}
          value={form.amountMinor}
          onChange={(e) => setForm({ ...form, amountMinor: e.target.value })}
          required
        />
        <button type="submit" className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs text-white">
          {t("create")}
        </button>
      </form>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm">{r.toIban}</span>
              <span className="text-xs text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.amountMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "ACTIVE" ? (
              <button
                type="button"
                className="mt-2 text-xs text-dbo-primary"
                onClick={() => void pause(r.id)}
              >
                {t("pause")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
