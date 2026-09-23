"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

type GrantMeta = {
  id: string;
  amount: number;
  expiresAt: string;
  status: string;
  createdAt: string;
};

function grantCodeStorageKey(grantId: string) {
  return `buyerGrantCode:${grantId}`;
}

export default function BuyerGrantDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const grantId = params.id;
  const [grant, setGrant] = useState<GrantMeta | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!grantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/buyer/trade-credit/grants/${grantId}`);
      const text = await res.text();
      if (!res.ok) {
        setError(text || t("buyer.grantNotFound"));
        setGrant(null);
        return;
      }
      setGrant(JSON.parse(text) as GrantMeta);
      const stored = sessionStorage.getItem(grantCodeStorageKey(grantId));
      setCode(stored);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("buyer.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [grantId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!code) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(code, { margin: 2, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-neutral-50 p-4">
      <header className="mb-4">
        <Link
          href="/buyer"
          className="text-sm font-medium text-neutral-600 underline"
        >
          {t("buyer.backToCabinet")}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-neutral-900">
          {t("buyer.grantDetailTitle")}
        </h1>
      </header>

      {loading ? (
        <p className="text-sm text-neutral-500">{t("buyer.loading")}</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {grant ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">{t("buyer.grantStatus")}</dt>
                <dd className="font-medium text-neutral-900">{grant.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">{t("buyer.grantAmountLabel")}</dt>
                <dd className="tabular-nums text-neutral-900">
                  {grant.amount.toFixed(2)} AZN
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">{t("buyer.grantExpires")}</dt>
                <dd className="text-neutral-900">{bakuDateTimeDisplay(grant.expiresAt)}</dd>
              </div>
            </dl>
          </section>

          {code ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-800">{t("buyer.codeOnceHint")}</p>
              <p className="mt-3 text-center font-mono text-2xl font-semibold tracking-widest text-emerald-950">
                {code}
              </p>
              {qrDataUrl ? (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={t("buyer.grantQrHint")}
                    className="h-44 w-44 rounded-md bg-white p-2"
                  />
                  <p className="text-xs text-emerald-800">{t("buyer.grantQrHint")}</p>
                </div>
              ) : null}
            </section>
          ) : (
            <p className="text-sm text-neutral-500">{t("buyer.grantCodeUnavailable")}</p>
          )}
        </div>
      ) : null}
    </main>
  );
}
