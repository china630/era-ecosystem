"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  PageHeader,
  countryLabel,
  showApiError,
} from "@era/satellite-kit/ui";

type Row = { code: string; count: number };

export default function PatientsByCountryReportPage() {
  const t = useTranslations("patientCountryReport");
  const tc = useTranslations("common");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const load = useCallback(async () => {
    const res = await fetch("/api/reports/patients-by-country");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    const payload = data.data ?? data;
    setItems(Array.isArray(payload.items) ? payload.items : []);
    setTotal(typeof payload.total === "number" ? payload.total : 0);
    setPage(1);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={nav("patientCountryReport")} subtitle={t("subtitle")} />
      <EraListWorkspace
        toolbar={<p className="text-sm text-[#7F8C8D]">{t("total", { count: total })}</p>}
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCountry")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colCount")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={3}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                pagedItems.map((row) => (
                  <tr key={row.code || "unknown"} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.code ? countryLabel(locale, row.code) : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code || "—"}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.count}</td>
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
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        }
      />
    </div>
  );
}
