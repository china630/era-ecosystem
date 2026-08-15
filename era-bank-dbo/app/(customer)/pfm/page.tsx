"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";

type PfmSummary = {
  totalBalanceMinor?: string;
  accountCount?: number;
  spendCategories?: { code: string; label: string; amountMinor: string }[];
  note?: string;
};

export default function PfmPage() {
  const t = useTranslations("pfm");
  const tCommon = useTranslations("common");
  const [data, setData] = useState<PfmSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pfm", { cache: "no-store" });
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {loading ? (
        <p className="text-sm text-dbo-muted">{tCommon("loading")}</p>
      ) : !data ? (
        <p className="text-sm text-dbo-muted">{tCommon("error")}</p>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-dbo-muted">{t("totalBalance")}</p>
            <p className="text-2xl font-semibold text-dbo-ink">
              {(Number(data.totalBalanceMinor ?? 0) / 100).toFixed(2)} AZN
            </p>
            <p className="mt-1 text-xs text-dbo-muted">
              {t("accounts")}: {data.accountCount ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("spendCategories")}</h2>
            <ul className="space-y-2 text-sm">
              {(data.spendCategories ?? []).map((c) => (
                <li key={c.code} className="flex justify-between">
                  <span>{c.label}</span>
                  <span>{(Number(c.amountMinor) / 100).toFixed(2)} AZN</span>
                </li>
              ))}
            </ul>
            {data.note ? (
              <p className="mt-3 text-xs text-dbo-muted">{data.note}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
