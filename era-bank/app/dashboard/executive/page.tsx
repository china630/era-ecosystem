"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";

type TrialRow = {
  glAccountId?: string;
  glCode?: string;
  debitMinor?: unknown;
  creditMinor?: unknown;
  debit?: number;
  credit?: number;
};

export default function ExecutiveDashboardPage() {
  const t = useTranslations("pages.executive");
  const [rows, setRows] = useState<TrialRow[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch(`/api/gl/trial-balance?date=${today}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data as TrialRow[]);
      })
      .catch(() => undefined);
  }, [today]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={CARD_CONTAINER_CLASS}>
        <p className="mb-3 text-sm text-muted-foreground">{t("readOnly")}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2">GL</th>
                <th className="px-3 py-2">Debit</th>
                <th className="px-3 py-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-2">{row.glCode ?? row.glAccountId ?? "—"}</td>
                  <td className="px-3 py-2">{String(row.debit ?? row.debitMinor ?? "—")}</td>
                  <td className="px-3 py-2">{String(row.credit ?? row.creditMinor ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
