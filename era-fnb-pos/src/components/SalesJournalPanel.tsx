"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";
import { SaleTable, type SaleRowView, type SaleTotalsView } from "@/components/SaleTable";

type Report = {
  rows: SaleRowView[];
  totals: SaleTotalsView;
  shift: { openedBy: string | null; outletCode: string } | null;
};

const EMPTY: SaleTotalsView = { cash: 0, card: 0, transfer: 0, count: 0, sum: 0 };

export default function SalesJournalPanel() {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const [scope, setScope] = useState<"today" | "shift">("today");
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(async (next: "today" | "shift") => {
    const res = await fetch(`/api/sales?scope=${next}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setReport({ rows: [], totals: EMPTY, shift: null });
      return;
    }
    setReport(data as Report);
  }, []);

  useEffect(() => {
    void load(scope);
  }, [load, scope]);

  const labels = {
    time: t("time"),
    place: t("place"),
    method: t("method"),
    sum: t("sum"),
    empty: t("empty"),
    cash: t("cash"),
    card: t("card"),
    transfer: t("transfer"),
    count: t("count"),
    takeaway: t("takeaway"),
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-medium ${
            scope === "today" ? "bg-[#2980B9] text-white" : "bg-[#EBEDF0] text-[#34495E]"
          }`}
          onClick={() => setScope("today")}
        >
          {t("today")}
        </button>
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-medium ${
            scope === "shift" ? "bg-[#2980B9] text-white" : "bg-[#EBEDF0] text-[#34495E]"
          }`}
          onClick={() => setScope("shift")}
        >
          {t("thisShift")}
        </button>
      </div>
      <div className={`${CARD_CLASS} p-4`}>
        {report?.shift?.openedBy ? (
          <p className="mb-2 text-sm text-[#7F8C8D]">
            {report.shift.outletCode} · {report.shift.openedBy}
          </p>
        ) : null}
        <SaleTable
          rows={report?.rows ?? []}
          totals={report?.totals ?? EMPTY}
          labels={labels}
          azn={tc("azn")}
        />
      </div>
    </div>
  );
}
