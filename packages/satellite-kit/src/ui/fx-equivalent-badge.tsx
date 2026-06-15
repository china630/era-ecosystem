"use client";

import { useEffect, useState } from "react";

export type FxEquivalentPreview = {
  from: string;
  to: string;
  amount: number;
  result: number;
  rateDate: string;
  source?: string;
  isFallback?: boolean;
};

export function FxEquivalentBadge({
  amount,
  currencyCode,
  to = "AZN",
  date,
  lookupPath = "/api/fx-preview",
  label,
  className,
}: {
  amount: number;
  currencyCode: string;
  to?: string;
  date?: string;
  lookupPath?: string;
  label?: string;
  className?: string;
}) {
  const from = currencyCode.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  const [preview, setPreview] = useState<FxEquivalentPreview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(amount) || amount <= 0) {
      setPreview(null);
      setError(false);
      return;
    }
    if (from === target) {
      setPreview(null);
      setError(false);
      return;
    }

    let cancelled = false;
    const q = new URLSearchParams({
      from,
      amount: String(amount),
      to: target,
    });
    if (date) q.set("date", date);

    void fetch(`${lookupPath}?${q}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("fx preview failed");
        return (await res.json()) as FxEquivalentPreview;
      })
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [amount, date, from, lookupPath, target]);

  if (from === target) return null;
  if (error) {
    return (
      <span className={`text-xs text-[#7F8C8D] ${className ?? ""}`.trim()} title="FX preview unavailable">
        —
      </span>
    );
  }
  if (!preview) {
    return (
      <span className={`text-xs text-[#7F8C8D] ${className ?? ""}`.trim()}>…</span>
    );
  }

  const prefix = label ?? "≈";
  return (
    <span
      className={`text-xs text-[#7F8C8D] ${className ?? ""}`.trim()}
      title={`${preview.rateDate} · ${preview.source ?? "finance"}`}
    >
      {prefix} {preview.result.toFixed(2)} {preview.to}
      {preview.isFallback ? " *" : ""}
    </span>
  );
}
