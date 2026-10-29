"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TEXT_MUTED_CLASS, showApiError } from "@era/satellite-kit/ui";

type BlockStat = {
  free: number;
  paid: number;
  total: number;
  amount: number;
};

type Summary = {
  date: string;
  visitsToday: number;
  openLabOrders: number;
  blocks: {
    procedures: BlockStat;
    diagnostics: BlockStat;
    labs: BlockStat;
  };
  capacity: {
    guestEquivalent: number;
    scheduledSlots: number;
    riskLevel: string;
  };
};

export function ExecutiveDashboard({
  from,
  to,
  date,
  refreshKey = 0,
}: {
  from?: string;
  to?: string;
  /** @deprecated prefer from/to */
  date?: string;
  refreshKey?: number;
}) {
  const t = useTranslations("executive");
  const tc = useTranslations("common");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeFrom = from ?? date ?? "";
  const rangeTo = to ?? date ?? from ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (rangeFrom) params.set("from", rangeFrom);
    if (rangeTo) params.set("to", rangeTo);
    if (!rangeFrom && date) params.set("date", date);
    const res = await fetch(`/api/executive/summary?${params}`);
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("loadFailed"));
      setSummary(null);
    } else {
      setSummary((data.data ?? data) as Summary);
    }
    setLoading(false);
  }, [rangeFrom, rangeTo, date, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  if (!summary) return null;

  const cards: Array<{ key: keyof Summary["blocks"]; title: string }> = [
    { key: "procedures", title: t("blockProcedures") },
    { key: "diagnostics", title: t("blockDiagnostics") },
    { key: "labs", title: t("blockLabs") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const block = summary.blocks[card.key];
          return (
            <section key={card.key} className="rounded-lg border border-[#D5DADF] p-4">
              <h3 className={`m-0 text-[13px] font-medium ${TEXT_MUTED_CLASS}`}>{card.title}</h3>
              <p className="mb-3 mt-1 text-2xl font-semibold tabular-nums">
                {block.amount.toFixed(2)} AZN
              </p>
              <dl className="space-y-1 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className={TEXT_MUTED_CLASS}>{t("countFree")}</dt>
                  <dd className="m-0 tabular-nums">{block.free}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className={TEXT_MUTED_CLASS}>{t("countPaid")}</dt>
                  <dd className="m-0 tabular-nums">{block.paid}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#D5DADF] pt-1 font-semibold">
                  <dt>{t("countTotal")}</dt>
                  <dd className="m-0 tabular-nums">{block.total}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
      <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
        <div className="rounded-lg border border-[#D5DADF] p-3">
          <dt className={TEXT_MUTED_CLASS}>{t("visitsToday")}</dt>
          <dd className="text-xl font-semibold">{summary.visitsToday}</dd>
        </div>
        <div className="rounded-lg border border-[#D5DADF] p-3">
          <dt className={TEXT_MUTED_CLASS}>{t("openLabOrders")}</dt>
          <dd className="text-xl font-semibold">{summary.openLabOrders}</dd>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            summary.capacity.riskLevel === "critical"
              ? "border-red-400 bg-red-50"
              : summary.capacity.riskLevel === "warning"
                ? "border-amber-400 bg-amber-50"
                : "border-[#D5DADF]"
          }`}
        >
          <dt className={TEXT_MUTED_CLASS}>{t("capacityTitle")}</dt>
          <dd className="text-xl font-semibold">~{summary.capacity.guestEquivalent}</dd>
          <dd className={`text-xs ${TEXT_MUTED_CLASS}`}>
            {summary.capacity.scheduledSlots} · {summary.capacity.riskLevel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
