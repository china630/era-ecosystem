"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type CatalogRow = {
  id: string;
  code: string;
  description: string;
  amount: string;
  syncedAt: string;
};

function isStale(syncedAt: string): boolean {
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

export default function CatalogAdminPage() {
  const t = useTranslations("catalogAdmin");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const latestSync = rows.reduce<Date | null>((max, row) => {
    const d = new Date(row.syncedAt);
    return !max || d > max ? d : max;
  }, null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/catalog");
    if (res.ok) {
      const d = await res.json();
      setRows((d.data ?? d) as CatalogRow[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setMsg(null);
    const res = await fetch("/api/catalog/sync", { method: "POST" });
    const d = await res.json();
    setMsg(res.ok ? t("synced", { count: d.data?.synced ?? d.synced ?? 0 }) : tc("failed"));
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void sync()}>
            {t("syncFromFinance")}
          </button>
        }
      />
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
      {latestSync ? (
        <p className={`mb-3 text-[13px] ${isStale(latestSync.toISOString()) ? "text-amber-700" : "text-[#7F8C8D]"}`}>
          {t("lastSync")}: {latestSync.toLocaleString()}
          {isStale(latestSync.toISOString()) ? ` · ${t("stale")}` : ""}
        </p>
      ) : null}
      <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b text-[#7F8C8D]">
              <th className="p-2">{t("code")}</th>
              <th className="p-2">{t("description")}</th>
              <th className="p-2">{t("amount")}</th>
              <th className="p-2">{t("lastSync")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.code}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2">{r.amount} AZN</td>
                <td className={`p-2 ${isStale(r.syncedAt) ? "text-amber-700" : ""}`}>
                  {new Date(r.syncedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-[#7F8C8D]">
                  {t("empty")}{" "}
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void sync()}>
                    {t("syncFromFinance")}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
