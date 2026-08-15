"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  requestedMinor?: number;
  productTemplateId?: string;
};

export default function LoanApplyPage() {
  const t = useTranslations("loanApply");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    productTemplateId: "",
    requestedMinor: "",
  });

  async function load() {
    const res = await fetch("/api/loans/applications");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/loans/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTemplateId: form.productTemplateId,
        requestedMinor: Math.round(Number(form.requestedMinor) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? tc("error"));
      return;
    }
    setForm({ productTemplateId: "", requestedMinor: "" });
    await load();
  }

  async function submit(id: string) {
    const res = await fetch(`/api/loans/applications/${id}/submit`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? tc("error"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <form className="space-y-2 rounded-xl bg-white p-3 shadow-sm" onSubmit={create}>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("product")}
          value={form.productTemplateId}
          onChange={(e) => setForm({ ...form, productTemplateId: e.target.value })}
          required
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder={t("amount")}
          value={form.requestedMinor}
          onChange={(e) => setForm({ ...form, requestedMinor: e.target.value })}
          required
        />
        <button type="submit" className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs text-white">
          {t("create")}
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{r.productTemplateId}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.requestedMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "DRAFT" ? (
              <button
                type="button"
                className="mt-2 text-xs text-dbo-primary"
                onClick={() => void submit(r.id)}
              >
                {t("submit")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
