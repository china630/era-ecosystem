"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { bakuTimeLabel, todayBakuYmd } from "@era/satellite-kit/time";
import {
  CatalogField,
  type CatalogFieldKind,
  DatePicker,
  ModalShell,
  PageHeader,
  showApiError,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";
import { CheckLines, type CheckLine } from "@/components/CheckLines";
import { SaleTable, type SaleRowView, type SaleTotalsView } from "@/components/SaleTable";

type Report = {
  rows: SaleRowView[];
  totals: SaleTotalsView;
  shift: { openedBy: string | null; outletCode: string } | null;
};

type CheckView = {
  dayNo: number | null;
  totalAzn: string | number;
  openedAt?: string | null;
  closedAt?: string | null;
  serviceChannel?: string | null;
  table?: { name?: string | null; code?: string | null } | null;
  lines: CheckLine[];
};

const EMPTY: SaleTotalsView = { cash: 0, card: 0, transfer: 0, count: 0, sum: 0 };

export default function SalesJournalPanel() {
  const t = useTranslations("sales");
  const tf = useTranslations("floor");
  const tc = useTranslations("common");
  const [scope, setScope] = useState<"today" | "shift">("today");
  const [date, setDate] = useState(todayBakuYmd);
  const [channel, setChannel] = useState("");
  const [method, setMethod] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [check, setCheck] = useState<CheckView | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ scope });
    if (scope === "today") params.set("date", date);
    if (channel) params.set("channel", channel);
    if (method) params.set("method", method);
    const res = await fetch(`/api/sales?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setReport({ rows: [], totals: EMPTY, shift: null });
      return;
    }
    setReport(data as Report);
  }, [scope, date, channel, method]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCheck(id: string) {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      showApiError(data, tc("failed"));
      return;
    }
    const lines = Array.isArray(data.lines)
      ? data.lines.filter(
          (line: { kitchenStatus?: string }) => line.kitchenStatus !== "VOID",
        )
      : [];
    setCheck({ ...(data as CheckView), lines });
  }

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

  const place =
    check?.table?.name?.trim() ||
    check?.table?.code ||
    (check?.serviceChannel === "TAKEAWAY" ? t("takeaway") : "—");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-wrap items-end gap-3">
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
        <DatePicker
          label={t("date")}
          value={date}
          placeholder={tc("datePlaceholder")}
          disabled={scope === "shift"}
          onChange={(next) => {
            setScope("today");
            if (next) setDate(next);
          }}
        />
        <div className="min-w-[12rem]">
          <CatalogField
            kind={"CLOSED_SMALL" as CatalogFieldKind}
            label={t("place")}
            value={channel}
            options={[
              { value: "DINE_IN", label: t("dineIn") },
              { value: "TAKEAWAY", label: t("takeaway") },
            ]}
            onChange={(next) => setChannel(Array.isArray(next) ? next[0] ?? "" : next)}
          />
        </div>
        <div className="min-w-[12rem]">
          <CatalogField
            kind={"CLOSED_SMALL" as CatalogFieldKind}
            label={t("method")}
            value={method}
            options={[
              { value: "CASH", label: t("cash") },
              { value: "CARD", label: t("card") },
              { value: "TRANSFER", label: t("transfer") },
            ]}
            onChange={(next) => setMethod(Array.isArray(next) ? next[0] ?? "" : next)}
          />
        </div>
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
          onOpen={(id) => void openCheck(id)}
        />
      </div>
      <ModalShell
        open={check != null}
        title={t("checkTitle", { no: check?.dayNo ?? "—", place })}
        maxWidthClass="max-w-2xl"
        onClose={() => setCheck(null)}
      >
        {check ? (
          <>
            <p className="mb-3 text-sm text-[#7F8C8D]">
              {t("opened")}: {check.openedAt ? bakuTimeLabel(check.openedAt) : "—"}
              {" · "}
              {t("closed")}: {check.closedAt ? bakuTimeLabel(check.closedAt) : "—"}
            </p>
            <CheckLines
              lines={check.lines}
              labels={{
                name: tf("colName"),
                qty: tf("colQty"),
                price: tf("colPrice"),
                sum: tf("colSum"),
                minus: tf("qtyMinus"),
                plus: tf("qtyPlus"),
              }}
              azn={tc("azn")}
            />
            <p className="mt-3 text-right text-2xl font-semibold tabular-nums text-[#2C3E50]">
              {Number(check.totalAzn).toFixed(2)} {tc("azn")}
            </p>
          </>
        ) : null}
      </ModalShell>
    </div>
  );
}
