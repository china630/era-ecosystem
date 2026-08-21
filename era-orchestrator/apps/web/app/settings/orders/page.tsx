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

type OrderRow = {
  id: string;
  status?: string;
  amountAzn?: string | number;
  provider?: string;
  createdAt?: string;
  paymentUrl?: string | null;
};

export default function OrdersPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const t = useTranslations("settings.orders");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await orchFetch("/v1/billing/payment-orders", { token });
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as OrderRow[] | { items?: OrderRow[] };
    setItems(Array.isArray(data) ? data : (data.items ?? []));
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function loadDetail(id: string) {
    if (!token) return;
    setError(null);
    const res = await orchFetch(`/v1/billing/orders/${id}`, { token });
    if (!res.ok) {
      setError(t("detailFailed"));
      return;
    }
    setDetail((await res.json()) as OrderRow);
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
          {items.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-mono text-xs text-[#34495E]">{o.id}</p>
                <p className="text-xs text-[#7F8C8D]">
                  {o.status ?? "—"} · {String(o.amountAzn ?? "—")} AZN
                  {o.provider ? ` · ${o.provider}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => void loadDetail(o.id)}
              >
                {t("refreshStatus")}
              </button>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
          ) : null}
        </ul>
      </div>
      {detail ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm`}>
          <h2 className="font-semibold text-[#34495E]">{t("detailTitle")}</h2>
          <pre className="mt-2 overflow-auto text-xs text-[#7F8C8D]">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
