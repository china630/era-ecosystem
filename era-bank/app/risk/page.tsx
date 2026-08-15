"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { formatAznMajor } from "@/lib/bank-lookups";

type Dashboard = {
  loanCount: number;
  nplCount: number;
  outstandingTotalMinor: string;
  byStage: { 1: number; 2: number; 3: number };
  lastEclRun?: {
    id: string;
    asOfDate: string;
    totalEclMinor: string;
    provisionDeltaMinor: string;
  } | null;
  note?: string;
};

export default function RiskDashboardPage() {
  const t = useTranslations("pages.risk");
  const tCommon = useTranslations("common");
  const [data, setData] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/risk/dashboard", { cache: "no-store" });
      if (!res.ok) {
        showApiError(tCommon("error"));
        return;
      }
      setData((await res.json()) as Dashboard);
    } catch {
      showApiError(tCommon("error"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("scaffoldNote")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void load()}
          >
            {tCommon("refresh")}
          </button>
        }
      />
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("loanCount")} value={String(data.loanCount)} />
          <Stat label={t("nplCount")} value={String(data.nplCount)} />
          <Stat
            label={t("outstanding")}
            value={formatAznMajor(data.outstandingTotalMinor)}
          />
          <Stat
            label={t("byStage")}
            value={`1:${data.byStage[1]} · 2:${data.byStage[2]} · 3:${data.byStage[3]}`}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      )}
      {data?.lastEclRun ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-[12px] text-muted-foreground">{t("lastEclRun")}</p>
          <p className="mt-1">
            {data.lastEclRun.asOfDate} · {t("eclTotal")}:{" "}
            {formatAznMajor(data.lastEclRun.totalEclMinor)} ·{" "}
            {t("provisionDelta")}:{" "}
            {formatAznMajor(data.lastEclRun.provisionDeltaMinor)}
          </p>
        </div>
      ) : null}
      {data?.note ? (
        <p className="text-xs text-muted-foreground">{data.note}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}
