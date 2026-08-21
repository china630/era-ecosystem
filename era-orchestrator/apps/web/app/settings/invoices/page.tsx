"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import { orchFetch } from "../../../lib/orch-api";

type InvoiceRow = {
  id: string;
  amount?: string | number;
  status?: string;
  date?: string;
  billingPeriod?: string | null;
  pdfUrl?: string | null;
};

export default function InvoicesPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("settings.invoices");
  const [items, setItems] = useState<InvoiceRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await orchFetch(
      `/v1/billing/invoices?page=${page}&pageSize=${pageSize}`,
      { token },
    );
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      items?: InvoiceRow[];
      total?: number;
    };
    setItems(data.items ?? []);
    setTotal(data.total ?? (data.items?.length ?? 0));
    setLoading(false);
  }, [token, page, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function downloadPdf(id: string) {
    if (!token) return;
    const res = await orchFetch(`/v1/billing/invoices/${id}/pdf`, { token });
    if (!res.ok) {
      setError(t("pdfFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscription-invoice-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <Link href="/settings/subscription" className={SECONDARY_BUTTON_CLASS}>
        ← {t("back")}
      </Link>
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      <div className={CARD_CONTAINER_CLASS}>
        <ul className="divide-y divide-[#EBEDF0]">
          {items.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-[#34495E]">
                  {inv.billingPeriod ?? inv.date ?? inv.id.slice(0, 8)}
                </p>
                <p className="text-xs text-[#7F8C8D]">
                  {inv.status ?? "—"} · {String(inv.amount ?? "—")} AZN
                </p>
              </div>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void downloadPdf(inv.id)}
              >
                {t("downloadPdf")}
              </button>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
          ) : null}
        </ul>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t("prev")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
