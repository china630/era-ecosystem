"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import {
  CatalogField,
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

type FulfillmentItem = {
  procedure: { code: string; name: string };
  packageAssigned: number;
  packageCompleted: number;
  extraAssigned: number;
  extraCompleted: number;
  extraAmount: number;
};

export default function ProceduresReportPage() {
  const t = useTranslations("common");
  const tr = useTranslations("procedureReports");
  const tc = useTranslations("nav");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const canPickDoctor = auth?.staffKind !== "DOCTOR";

  const [from, setFrom] = useState(addBakuDays(todayBakuYmd(), -30));
  const [to, setTo] = useState(todayBakuYmd());
  const [procedure, setProcedure] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [procedureOptions, setProcedureOptions] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [from, to, procedure, doctorId, pageSize]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ view: "fulfillment", from, to, locale });
    if (procedure) params.set("procedure", procedure);
    if (doctorId) params.set("doctorId", doctorId);
    return `/api/reports/procedures?${params.toString()}`;
  }, [from, to, procedure, doctorId, locale]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/procedure-types?locale=${encodeURIComponent(locale)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const rows = (raw.data ?? raw) as Array<{ code?: string; name?: string }>;
        if (!Array.isArray(rows)) return;
        setProcedureOptions(
          rows
            .filter((row) => Boolean(row.code))
            .map((row) => ({
              value: row.code as string,
              label: row.name ? `${row.name} (${row.code})` : (row.code as string),
            })),
        );
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!canPickDoctor || doctors.length > 0) return;
    let cancelled = false;
    void fetch("/api/reports/procedures/doctors")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const payload = (raw.data ?? raw) as { items?: Array<{ id: string; fullName?: string }> };
        setDoctors(
          (payload.items ?? [])
            .filter((row) => Boolean(row.id))
            .map((row) => ({ id: row.id, fullName: row.fullName ?? row.id })),
        );
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [canPickDoctor, doctors.length]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as {
          data?: { items?: FulfillmentItem[]; grandTotal?: number };
          items?: FulfillmentItem[];
          grandTotal?: number;
        };
        if (!res.ok) {
          showApiError(body, tr("loadFailed"));
          return;
        }
        if (cancelled) return;
        const payload = body.data ?? body;
        setItems(payload.items ?? []);
        setGrandTotal(typeof payload.grandTotal === "number" ? payload.grandTotal : null);
      })
      .catch(() => showApiError({ error: tr("loadFailed") }))
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, tr]);

  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("procedureReport")} subtitle={tr("subtitle")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={t("filterReset")}
            onReset={() => {
              setFrom(addBakuDays(todayBakuYmd(), -30));
              setTo(todayBakuYmd());
              setProcedure("");
              setDoctorId("");
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
            <CatalogField
              kind="SEARCHABLE"
              label={tr("procedure")}
              value={procedure}
              onChange={(value) => setProcedure(String(value ?? ""))}
              options={[{ value: "", label: t("all") }, ...procedureOptions]}
              emptyLabel={t("all")}
              widthPreset="selectWide"
            />
            {canPickDoctor ? (
              <CatalogField
                kind="SEARCHABLE"
                label={tr("doctor")}
                value={doctorId}
                onChange={(value) => setDoctorId(String(value ?? ""))}
                options={[
                  { value: "", label: tr("allDoctors") },
                  ...doctors.map((row) => ({ value: row.id, label: row.fullName })),
                ]}
                emptyLabel={tr("allDoctors")}
                widthPreset="selectWide"
              />
            ) : null}
          </EraListFilterBar>
        }
        toolbar={
          grandTotal != null ? (
            <p className={`text-sm ${TEXT_MUTED_CLASS}`}>
              {tr("grandTotal", { amount: grandTotal.toFixed(2) })}
            </p>
          ) : null
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colProcedure")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colPackageAssigned")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colPackageCompleted")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraAssigned")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraCompleted")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {tr("empty")}
                  </td>
                </tr>
              ) : (
                pagedItems.map((row) => (
                  <tr key={row.procedure.code} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.procedure.code} — {row.procedure.name}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.packageAssigned}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.packageCompleted}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.extraAssigned}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.extraCompleted}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.extraAmount.toFixed(2)}</td>
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
