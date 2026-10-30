"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  PageHeader,
  TEXT_MUTED_CLASS,
  showApiError,
} from "@era/satellite-kit/ui";
import { addBakuDays, todayBakuYmd } from "@/lib/baku-day";

type RevenueItem = {
  revenueCode: string;
  quantity: number;
  amount: number;
};

export default function RevenueReportPage() {
  const t = useTranslations("common");
  const tr = useTranslations("revenueReport");
  const tc = useTranslations("nav");
  const [from, setFrom] = useState(addBakuDays(todayBakuYmd(), -30));
  const [to, setTo] = useState(todayBakuYmd());
  const [items, setItems] = useState<RevenueItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const url = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    return `/api/reports/revenue?${params.toString()}`;
  }, [from, to]);

  useEffect(() => {
    setPage(1);
  }, [from, to, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as { items?: RevenueItem[]; grandTotal?: number; error?: string };
        if (!res.ok) {
          showApiError(body, tr("loadFailed"));
          return;
        }
        if (cancelled) return;
        setItems(body.items ?? []);
        setGrandTotal(typeof body.grandTotal === "number" ? body.grandTotal : null);
      })
      .catch(() => showApiError({ error: tr("loadFailed") }))
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, tr]);

  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("revenueReport")} subtitle={tr("subtitle")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={t("filterReset")}
            onReset={() => {
              setFrom(addBakuDays(todayBakuYmd(), -30));
              setTo(todayBakuYmd());
            }}
          >
            <DatePicker
              label={tr("from")}
              value={from}
              onChange={setFrom}
              placeholder={t("datePlaceholder")}
              openCalendarLabel={t("openCalendar")}
            />
            <DatePicker
              label={tr("to")}
              value={to}
              onChange={setTo}
              placeholder={t("datePlaceholder")}
              openCalendarLabel={t("openCalendar")}
            />
          </EraListFilterBar>
        }
        toolbar={
          grandTotal != null ? (
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tr("grandTotal", { amount: grandTotal.toFixed(2) })}</p>
          ) : null
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colCode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colQty")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={3}>
                    {tr("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.revenueCode} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.revenueCode}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={items.length}
            loading={busy}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            labels={{
              rowsPerPage: t("rowsPerPage"),
              pageOf: t("pageOf"),
              prev: t("prev"),
              next: t("next"),
            }}
          />
        }
      />
    </div>
  );
}
