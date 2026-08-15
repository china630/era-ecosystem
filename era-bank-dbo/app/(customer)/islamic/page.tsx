"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  kind?: string;
  status?: string;
  principalMinor?: number;
};

export default function IslamicPage() {
  const t = useTranslations("islamic");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/islamic/contracts")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")));
  }, [tc]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-sm text-dbo-muted">{t("subtitle")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{r.kind}</span>
              <span className="text-dbo-muted">{r.status}</span>
            </div>
            <p className="text-sm text-dbo-muted">
              {((r.principalMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
