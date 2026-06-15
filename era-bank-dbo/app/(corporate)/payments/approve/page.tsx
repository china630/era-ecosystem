"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SignRequest = {
  id: string;
  engineOrderId: string;
  status: string;
  expiresAt: string;
};

export default function CorporateApprovePage() {
  const t = useTranslations("approve");
  const tc = useTranslations("common");
  const [items, setItems] = useState<SignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadQueue() {
    setLoading(true);
    fetch("/api/payments/sign-requests")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tc("error")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQueue();
  }, [tc]);

  async function signItem(item: SignRequest) {
    setBusyId(item.id);
    setError(null);
    try {
      const asanRes = await fetch("/api/auth/asan/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "CORP-SIGNATORY", channel: "CORPORATE" }),
      });
      const asanData = await asanRes.json();
      if (!asanRes.ok) throw new Error(asanData.error);

      const signRes = await fetch(`/api/payments/orders/${item.engineOrderId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asanTransactionId: asanData.transactionId }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);

      const submitRes = await fetch(`/api/payments/orders/${item.engineOrderId}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": `corp-submit-${item.engineOrderId}` },
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error);

      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      {loading ? <p className="text-sm text-dbo-muted">{tc("loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-dbo-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-dbo-muted">{t("orderId")}</p>
              <p className="font-mono text-sm">{item.engineOrderId}</p>
              <p className="mt-1 text-xs text-dbo-muted">{item.status}</p>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => signItem(item)}
                className="mt-3 w-full rounded-lg bg-dbo-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t("sign")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
