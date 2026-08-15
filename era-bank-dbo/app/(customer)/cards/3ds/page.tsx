"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  status?: string;
  amountMinor?: number;
  cardId?: string;
};

export default function ThreeDsPage() {
  const t = useTranslations("threeDs");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/cards/3ds/challenges");
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

  async function complete(id: string, success: boolean) {
    const res = await fetch(`/api/cards/3ds/challenges/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success }),
    });
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
      <p className="text-sm text-dbo-muted">{t("subtitle")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{String(r.cardId ?? "").slice(0, 8)}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.amountMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            {r.status === "PENDING" ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-dbo-primary px-2 py-1 text-xs text-white"
                  onClick={() => void complete(r.id, true)}
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => void complete(r.id, false)}
                >
                  {t("deny")}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
