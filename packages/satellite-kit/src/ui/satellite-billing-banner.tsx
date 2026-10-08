"use client";

import { useEffect, useState } from "react";
import {
  BILLING_BANNER_MESSAGES,
  billingBannerLocale,
} from "../billing/billing-banner-messages";

type BlockStatus = "SOFT_BLOCK" | "HARD_BLOCK";

const REFRESH_MS = 5 * 60_000;

/**
 * Org billing SOFT/HARD banner. Shows the status the API already enforces;
 * reads `GET /api/platform/billing-status` (kit route re-exported by each satellite).
 */
export function SatelliteBillingBanner({
  endpoint = "/api/platform/billing-status",
}: {
  endpoint?: string;
}) {
  const [status, setStatus] = useState<BlockStatus | null>(null);
  const [lang, setLang] = useState<string>("az");

  useEffect(() => {
    setLang(document.documentElement.lang || "az");
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const body = (await res.json()) as { billingStatus?: string | null };
        if (cancelled) return;
        setStatus(
          body.billingStatus === "SOFT_BLOCK" || body.billingStatus === "HARD_BLOCK"
            ? body.billingStatus
            : null,
        );
      } catch {
        /* keep the last known banner */
      }
    };
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [endpoint]);

  if (!status) return null;
  const text = BILLING_BANNER_MESSAGES[billingBannerLocale(lang)][status];
  const tone =
    status === "HARD_BLOCK"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div
      role="alert"
      data-testid="billing-banner"
      data-billing-status={status}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${tone}`}
    >
      {text}
    </div>
  );
}
