"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

type FxPreview = {
  from: string;
  to: string;
  amount: number;
  result: number;
  rateDate: string;
  source: string;
  isFallback: boolean;
};

export function FxPreviewCard() {
  const t = useTranslations("customs");
  const [from, setFrom] = useState("USD");
  const [amount, setAmount] = useState("100");
  const [preview, setPreview] = useState<FxPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        from: from.trim().toUpperCase(),
        amount: amount.trim() || "100",
      });
      const res = await fetch(`/api/fx-preview?${q}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? t("fxPreviewFailed"));
      }
      setPreview(body as FxPreview);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : t("fxPreviewFailed"));
    } finally {
      setLoading(false);
    }
  }, [amount, from, t]);

  return (
    <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
      <h2 className="text-sm font-semibold text-[#2C3E50]">{t("fxPreviewTitle")}</h2>
      <p className="text-xs text-[#7F8C8D]">{t("fxPreviewHint")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[#34495E]">
          {t("fxPreviewCurrency")}
          <input
            className="mt-1 block rounded border border-[#D5DBDB] px-2 py-1 text-sm uppercase"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            maxLength={3}
          />
        </label>
        <label className="text-xs text-[#34495E]">
          {t("fxPreviewAmount")}
          <input
            className="mt-1 block w-28 rounded border border-[#D5DBDB] px-2 py-1 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={loading}
          onClick={() => void loadPreview()}
        >
          {loading ? t("fxPreviewLoading") : t("fxPreviewButton")}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {preview ? (
        <p className="text-sm text-[#34495E]">
          {t("fxPreviewResult", {
            amount: preview.amount,
            from: preview.from,
            result: preview.result.toFixed(2),
            to: preview.to,
            date: preview.rateDate,
          })}
          {preview.isFallback ? (
            <span className="ml-1 text-xs text-amber-700">({t("fxPreviewFallback")})</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
