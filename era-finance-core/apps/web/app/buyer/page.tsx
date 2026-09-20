"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type FacilityView = {
  counterpartyId: string;
  facilityId: string | null;
  creditLimit: number;
  stopList: boolean;
  status: string | null;
  openAr: number;
  unusedIssuedGrants: number;
  available: number;
  factorLeadEnabled?: boolean;
};

type OpenInvoice = {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
};

type IssuedGrant = {
  id: string;
  amount: number;
  expiresAt: string;
  code: string;
};

type NotifyPrefs = {
  notifyOptIn: boolean;
  notifyChannel: string | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const PULL_THRESHOLD_PX = 72;

function grantCodeStorageKey(grantId: string) {
  return `buyerGrantCode:${grantId}`;
}

export default function BuyerPortalHomePage() {
  const { t } = useTranslation();
  const [facility, setFacility] = useState<FacilityView | null>(null);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [notifyOptIn, setNotifyOptIn] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGrant, setLastGrant] = useState<IssuedGrant | null>(null);
  const [grantQrDataUrl, setGrantQrDataUrl] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const touchStartY = useRef<number | null>(null);
  const pulling = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [facRes, invRes, prefsRes] = await Promise.all([
        fetch("/api/buyer/trade-credit"),
        fetch("/api/buyer/trade-credit/invoices"),
        fetch("/api/buyer/trade-credit/notify-prefs"),
      ]);
      const facText = await facRes.text();
      const invText = await invRes.text();
      const prefsText = await prefsRes.text();
      if (!facRes.ok) {
        setError(facText || t("buyer.loadErr"));
        return;
      }
      setFacility(JSON.parse(facText) as FacilityView);
      if (invRes.ok) {
        setInvoices(JSON.parse(invText) as OpenInvoice[]);
      }
      if (prefsRes.ok) {
        const prefs = JSON.parse(prefsText) as NotifyPrefs;
        setNotifyOptIn(Boolean(prefs.notifyOptIn));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("buyer.loadErr"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lastGrant?.code) {
      setGrantQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(lastGrant.code, { margin: 2, width: 220 })
      .then(setGrantQrDataUrl)
      .catch(() => setGrantQrDataUrl(null));
  }, [lastGrant?.code]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/buyer-manifest.webmanifest";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/buyer-sw.js", { scope: "/buyer" });
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPwaPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  function onTouchStart(event: React.TouchEvent) {
    if (window.scrollY > 0) return;
    touchStartY.current = event.touches[0]?.clientY ?? null;
    pulling.current = false;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (touchStartY.current == null || window.scrollY > 0) return;
    const currentY = event.touches[0]?.clientY ?? touchStartY.current;
    const delta = currentY - touchStartY.current;
    if (delta > 0) {
      pulling.current = true;
      setPullDistance(Math.min(delta, PULL_THRESHOLD_PX + 24));
    }
  }

  function onTouchEnd() {
    if (pulling.current && pullDistance >= PULL_THRESHOLD_PX && !refreshing) {
      void load();
    }
    touchStartY.current = null;
    pulling.current = false;
    setPullDistance(0);
  }

  async function saveNotifyOptIn(next: boolean) {
    setNotifyBusy(true);
    setNotifyOptIn(next);
    try {
      const res = await fetch("/api/buyer/trade-credit/notify-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOptIn: next }),
      });
      if (!res.ok) {
        setNotifyOptIn(!next);
        toast.error(t("buyer.notifySaveErr"), {
          description: await res.text(),
        });
      }
    } catch (e) {
      setNotifyOptIn(!next);
      toast.error(
        e instanceof Error ? e.message : t("buyer.notifySaveErr"),
      );
    } finally {
      setNotifyBusy(false);
    }
  }

  async function requestGrant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastGrant(null);
    setGrantQrDataUrl(null);
    try {
      const res = await fetch("/api/buyer/trade-credit/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const text = await res.text();
      if (!res.ok) {
        setError(text || t("buyer.grantErr"));
        return;
      }
      const data = JSON.parse(text) as IssuedGrant;
      setLastGrant(data);
      sessionStorage.setItem(grantCodeStorageKey(data.id), data.code);
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("buyer.grantErr"));
    } finally {
      setBusy(false);
    }
  }

  async function payInvoice(invoiceId: string) {
    try {
      const res = await fetch(
        `/api/buyer/trade-credit/invoices/${invoiceId}/pay-link`,
        { method: "POST" },
      );
      const text = await res.text();
      if (!res.ok) {
        toast.error(t("buyer.payErr"), { description: text });
        return;
      }
      const body = JSON.parse(text) as { paymentUrl?: string };
      if (body.paymentUrl) {
        window.open(body.paymentUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(t("buyer.payErr"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("buyer.payErr"));
    }
  }

  async function submitFactorLead(invoiceId?: string) {
    try {
      const res = await fetch("/api/buyer/trade-credit/factor-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceId ? { invoiceId } : {}),
      });
      const text = await res.text();
      if (!res.ok) {
        toast.error(t("buyer.factorLeadErr"), { description: text });
        return;
      }
      const body = JSON.parse(text) as { message?: string };
      toast.success(body.message ?? t("buyer.factorLeadOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("buyer.factorLeadErr"));
    }
  }

  async function installPwa() {
    if (!pwaPrompt) return;
    await pwaPrompt.prompt();
    await pwaPrompt.userChoice;
    setPwaPrompt(null);
  }

  return (
    <main
      className="mx-auto min-h-dvh max-w-lg bg-neutral-50 pb-24"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {pullDistance > 0 ? (
        <div
          className="pointer-events-none flex justify-center py-2 text-xs text-neutral-500"
          style={{ height: pullDistance }}
        >
          {pullDistance >= PULL_THRESHOLD_PX
            ? t("buyer.pullRelease")
            : t("buyer.pullHint")}
        </div>
      ) : null}

      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {t("buyer.title")}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-600">
              {t("buyer.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-50"
            aria-label={t("buyer.refresh")}
          >
            {refreshing ? t("buyer.loading") : t("buyer.refresh")}
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-800">
            {t("tradeCredit.residualTitle")}
          </h2>
          {facility ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-neutral-500">{t("tradeCredit.creditLimit")}</dt>
              <dd className="text-right tabular-nums">
                {facility.creditLimit.toFixed(2)} AZN
              </dd>
              <dt className="text-neutral-500">{t("tradeCredit.openAr")}</dt>
              <dd className="text-right tabular-nums">
                {facility.openAr.toFixed(2)} AZN
              </dd>
              <dt className="text-neutral-500">
                {t("tradeCredit.unusedGrants")}
              </dt>
              <dd className="text-right tabular-nums">
                {facility.unusedIssuedGrants.toFixed(2)} AZN
              </dd>
              <dt className="font-medium text-neutral-700">
                {t("tradeCredit.available")}
              </dt>
              <dd className="text-right text-base font-semibold tabular-nums text-neutral-900">
                {facility.available.toFixed(2)} AZN
              </dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">{t("buyer.loading")}</p>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-neutral-300"
              checked={notifyOptIn}
              disabled={notifyBusy}
              onChange={(e) => void saveNotifyOptIn(e.target.checked)}
            />
            <span>{t("buyer.notifyOptIn")}</span>
          </label>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-800">
            {t("buyer.requestGrant")}
          </h2>
          <form className="mt-3 space-y-3" onSubmit={requestGrant}>
            <label className="block text-sm text-neutral-700">
              {t("buyer.grantAmount")}
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(ev) => setAmount(ev.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy || !amount}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? t("buyer.submitting") : t("buyer.submitGrant")}
            </button>
          </form>

          {lastGrant ? (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">
                {t("buyer.grantIssued", {
                  code: lastGrant.code,
                  amount: lastGrant.amount.toFixed(2),
                  expiresAt: lastGrant.expiresAt,
                })}
              </p>
              <p className="text-center font-mono text-2xl font-semibold tracking-widest text-emerald-950 sm:text-3xl">
                {lastGrant.code}
              </p>
              {grantQrDataUrl ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={grantQrDataUrl}
                    alt={t("buyer.grantQrHint")}
                    className="h-44 w-44 rounded-md bg-white p-2"
                  />
                  <p className="text-xs text-emerald-800">{t("buyer.grantQrHint")}</p>
                </div>
              ) : null}
              <p className="text-xs text-emerald-800">{t("buyer.codeOnceHint")}</p>
              <Link
                href={`/buyer/grants/${lastGrant.id}`}
                className="inline-flex text-sm font-medium text-emerald-900 underline"
              >
                {t("buyer.viewGrant")}
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-neutral-800">
              {t("buyer.openInvoices")}
            </h2>
            {facility?.factorLeadEnabled ? (
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                onClick={() => void submitFactorLead()}
              >
                {t("buyer.getPaidToday")}
              </button>
            ) : null}
          </div>

          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">{t("buyer.noInvoices")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {invoices.map((inv) => (
                <li key={inv.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{inv.number}</p>
                      <p className="text-xs text-neutral-500">
                        {t("buyer.colDue")}: {inv.dueDate}
                      </p>
                      <p className="mt-1 text-sm tabular-nums text-neutral-800">
                        {inv.remaining.toFixed(2)} {inv.currency}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                        onClick={() => void payInvoice(inv.id)}
                      >
                        {t("buyer.pay")}
                      </button>
                      {facility?.factorLeadEnabled ? (
                        <button
                          type="button"
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                          onClick={() => void submitFactorLead(inv.id)}
                        >
                          {t("buyer.getPaidToday")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pwaPrompt ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white p-4 shadow-lg sm:mx-auto sm:max-w-lg sm:rounded-t-xl">
          <p className="text-sm text-neutral-700">{t("buyer.pwaInstall")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void installPwa()}
            >
              {t("buyer.pwaInstallBtn")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
              onClick={() => setPwaPrompt(null)}
            >
              {t("buyer.pwaDismiss")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
