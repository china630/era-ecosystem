"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { formatAznMajor } from "@/lib/bank-lookups";

type CapitalAdequacy = {
  carRatio?: number | string;
  tier1Ratio?: number | string;
  totalCapitalMinor?: string | number;
  rwaTotalMinor?: string | number;
  asOfDate?: string;
  note?: string;
};

type RatioSnapshot = {
  ratio?: number | string;
  asOfDate?: string;
  note?: string;
  [key: string]: unknown;
};

type LargeExposure = {
  customerId?: string;
  exposureMinor?: string | number;
  pctOfCapital?: number | string;
};

export default function RiskCapitalPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const [capital, setCapital] = useState<CapitalAdequacy | null>(null);
  const [rwa, setRwa] = useState<RatioSnapshot | null>(null);
  const [lcr, setLcr] = useState<RatioSnapshot | null>(null);
  const [nsfr, setNsfr] = useState<RatioSnapshot | null>(null);
  const [large, setLarge] = useState<LargeExposure[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, rRes, lRes, nRes, xRes] = await Promise.all([
        fetch("/api/risk/capital-adequacy", { cache: "no-store" }),
        fetch("/api/risk/rwa", { cache: "no-store" }),
        fetch("/api/risk/lcr", { cache: "no-store" }),
        fetch("/api/risk/nsfr", { cache: "no-store" }),
        fetch("/api/risk/large-exposures", { cache: "no-store" }),
      ]);
      if (cRes.ok) setCapital((await cRes.json()) as CapitalAdequacy);
      if (rRes.ok) setRwa((await rRes.json()) as RatioSnapshot);
      if (lRes.ok) setLcr((await lRes.json()) as RatioSnapshot);
      if (nRes.ok) setNsfr((await nRes.json()) as RatioSnapshot);
      if (xRes.ok) {
        const body = await xRes.json();
        setLarge(Array.isArray(body) ? (body as LargeExposure[]) : []);
      }
    } catch {
      showApiError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCapital() {
    setBusy(true);
    try {
      const res = await fetch("/api/risk/capital/run", { method: "POST" });
      if (!res.ok) {
        showApiError(await res.text());
        return;
      }
      await load();
    } catch {
      showApiError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  function fmtRatio(v: unknown): string {
    if (v == null) return "—";
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && Math.abs(n) <= 10) return `${(n * 100).toFixed(2)}%`;
    if (Number.isFinite(n)) return `${n.toFixed(2)}%`;
    return String(v);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("capital")}
        subtitle={t("capitalSubtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void runCapital()}
          >
            {t("runCapital")}
          </button>
        }
      />
      <p className="text-sm text-amber-800 dark:text-amber-200">{t("labDisclaimer")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={CARD_CONTAINER_CLASS}>
          <p className="text-xs text-muted-foreground">{t("car")}</p>
          <p className="text-lg font-semibold">{fmtRatio(capital?.carRatio)}</p>
        </div>
        <div className={CARD_CONTAINER_CLASS}>
          <p className="text-xs text-muted-foreground">{t("tier1")}</p>
          <p className="text-lg font-semibold">{fmtRatio(capital?.tier1Ratio)}</p>
        </div>
        <div className={CARD_CONTAINER_CLASS}>
          <p className="text-xs text-muted-foreground">{t("lcr")}</p>
          <p className="text-lg font-semibold">{fmtRatio(lcr?.ratio ?? lcr?.lcr)}</p>
        </div>
        <div className={CARD_CONTAINER_CLASS}>
          <p className="text-xs text-muted-foreground">{t("nsfr")}</p>
          <p className="text-lg font-semibold">{fmtRatio(nsfr?.ratio ?? nsfr?.nsfr)}</p>
        </div>
      </div>
      <div className={CARD_CONTAINER_CLASS}>
        <p className="mb-2 font-medium">{t("rwa")}</p>
        <p className="text-sm">
          {formatAznMajor(
            String(capital?.rwaTotalMinor ?? rwa?.totalRwaMinor ?? rwa?.rwaTotalMinor ?? 0),
          )}
        </p>
      </div>
      <div className={CARD_CONTAINER_CLASS}>
        <p className="mb-2 font-medium">{t("largeExposures")}</p>
        {large.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {large.slice(0, 20).map((row, i) => (
              <li key={`${row.customerId ?? i}`}>
                {row.customerId ?? "—"}:{" "}
                {formatAznMajor(String(row.exposureMinor ?? 0))} (
                {fmtRatio(row.pctOfCapital)})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
