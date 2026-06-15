"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type PaymentOrder = {
  id: string;
  status?: string;
  amountMinor?: number;
  beneficiaryName?: string;
};

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payments/orders")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setOrders(Array.isArray(data.orders) ? data.orders : data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }, [tc]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Link
          href="/payments/new"
          className="rounded-lg bg-dbo-primary px-3 py-1.5 text-xs font-medium text-white"
        >
          {t("new")}
        </Link>
      </div>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="text-sm text-dbo-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{o.beneficiaryName ?? o.id}</span>
                <span className="text-xs text-dbo-muted">{o.status}</span>
              </div>
              <p className="text-sm text-dbo-muted">
                {((o.amountMinor ?? 0) / 100).toFixed(2)} AZN
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
