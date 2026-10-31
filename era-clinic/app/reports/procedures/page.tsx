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

type DoctorBonusItem = {
  procedure: { code: string; name: string };
  quantity: number;
  price: number;
  totalAmount: number;
};

type NurseWorkItem = {
  ymd: string;
  procedureCode: string;
  procedureName: string;
  quantity: number;
};

type ApiResponse = {
  view: string;
  items: any[];
  grandTotal?: number;
  grandTotalInHouse?: number;
  grandTotalWalkIn?: number;
  doctorBonusPercentInHouse?: number;
  doctorBonusPercentWalkIn?: number;
  bonusInHouse?: number;
  bonusWalkIn?: number;
  bonusTotal?: number;
};

function todayIsoBaku() {
  return todayBakuYmd();
}

function monthAgoBaku() {
  return addBakuDays(todayBakuYmd(), -30);
}

export default function ProceduresReportPage() {
  const t = useTranslations("common");
  const tr = useTranslations("procedureReports");
  const tc = useTranslations("nav");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const canSelectNurse =
    auth?.staffKind === "DOCTOR" || auth?.canViewClinicAdmin === true;
  const canPickDoctor = auth?.staffKind !== "DOCTOR";

  const [view, setView] = useState<"fulfillment" | "doctor-bonus" | "nurse-work">("fulfillment");
  const [from, setFrom] = useState(monthAgoBaku());
  const [to, setTo] = useState(todayIsoBaku());
  const [procedure, setProcedure] = useState<string>("");
  const [nurseId, setNurseId] = useState<string>("");
  const [nurses, setNurses] = useState<Array<{ id: string; fullName: string }>>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [procedureOptions, setProcedureOptions] = useState<Array<{ value: string; label: string }>>(
    [],
  );

  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [bonusBuckets, setBonusBuckets] = useState<{
    inHouse: number;
    walkIn: number;
    pctInHouse: number;
    pctWalkIn: number;
    bonusInHouse: number;
    bonusWalkIn: number;
    bonusTotal: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const tableItems = items;

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tableItems.slice(start, start + pageSize);
  }, [tableItems, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [view, from, to, procedure, nurseId, doctorId, pageSize]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      view,
      from,
      to,
      locale,
    });
    if (procedure) params.set("procedure", procedure);
    if (view === "nurse-work" && nurseId) params.set("nurseId", nurseId);
    if ((view === "fulfillment" || view === "doctor-bonus") && doctorId) {
      params.set("doctorId", doctorId);
    }
    return `/api/reports/procedures?${params.toString()}`;
  }, [view, from, to, procedure, nurseId, doctorId, locale]);

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
    if (view !== "nurse-work" || !canSelectNurse) return;
    if (nurses.length > 0) return;

    let cancelled = false;
    void fetch("/api/admin/practitioners?staffKind=NURSE")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const rows = (raw.data ?? raw) as Array<{ id: string; fullName?: string; code?: string }>;
        if (!Array.isArray(rows)) return;
        setNurses(
          rows
            .filter((r) => Boolean(r.id))
            .map((r) => ({ id: r.id, fullName: r.fullName ?? r.code ?? r.id }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [view, canSelectNurse, nurses.length]);

  useEffect(() => {
    if (!canPickDoctor) return;
    if (view !== "fulfillment" && view !== "doctor-bonus") return;
    if (doctors.length > 0) return;

    let cancelled = false;
    void fetch("/api/reports/procedures/doctors")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const payload = (raw.data ?? raw) as { items?: Array<{ id: string; fullName?: string }> };
        const rows = payload.items ?? [];
        if (!Array.isArray(rows)) return;
        setDoctors(
          rows
            .filter((row) => Boolean(row.id))
            .map((row) => ({ id: row.id, fullName: row.fullName ?? row.id })),
        );
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [view, canPickDoctor, doctors.length]);

  async function load() {
    setBusy(true);
    setItems([]);
    setGrandTotal(null);
    setBonusBuckets(null);
    try {
      const res = await fetch(url);
      const d = (await res.json()) as ApiResponse;
      if (!res.ok) {
        showApiError(d, tr("loadFailed"));
        return;
      }
      setItems(d.items ?? []);
      setPage(1);
      setGrandTotal(typeof d.grandTotal === "number" ? d.grandTotal : null);
      if (view === "doctor-bonus") {
        setBonusBuckets({
          inHouse: d.grandTotalInHouse ?? 0,
          walkIn: d.grandTotalWalkIn ?? 0,
          pctInHouse: d.doctorBonusPercentInHouse ?? 0,
          pctWalkIn: d.doctorBonusPercentWalkIn ?? 0,
          bonusInHouse: d.bonusInHouse ?? 0,
          bonusWalkIn: d.bonusWalkIn ?? 0,
          bonusTotal: d.bonusTotal ?? 0,
        });
      }
    } catch {
      showApiError({ error: tr("loadFailed") });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const colSpan = view === "fulfillment" ? 6 : view === "doctor-bonus" ? 4 : 3;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("procedureReport")} subtitle={tr("subtitle")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={t("filterReset")}
            onReset={() => {
              setView("fulfillment");
              setFrom(monthAgoBaku());
              setTo(todayIsoBaku());
              setProcedure("");
              setNurseId("");
              setDoctorId("");
            }}
          >
            <div className="basis-full">
              <CatalogField
                kind="CLOSED_SMALL"
                label={tr("view")}
                value={view}
                onChange={(value) => setView(String(value) as typeof view)}
                emptyLabel={null}
                widthPreset="selectWide"
                options={[
                  { value: "fulfillment", label: tr("viewFulfillment") },
                  { value: "doctor-bonus", label: tr("viewDoctorBonus") },
                  { value: "nurse-work", label: tr("viewNurseWork") },
                ]}
              />
            </div>
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
            {(view === "fulfillment" || view === "doctor-bonus") && canPickDoctor ? (
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
            {view === "nurse-work" && canSelectNurse ? (
              <CatalogField
                kind="SEARCHABLE"
                label={tr("nurse")}
                value={nurseId}
                onChange={(value) => setNurseId(String(value ?? ""))}
                options={[
                  { value: "", label: tr("allNurses") },
                  ...nurses.map((n) => ({ value: n.id, label: n.fullName })),
                ]}
                emptyLabel={tr("allNurses")}
                widthPreset="selectWide"
              />
            ) : null}
          </EraListFilterBar>
        }

        toolbar={
          grandTotal != null || bonusBuckets ? (
            <div className={`space-y-1 text-sm ${TEXT_MUTED_CLASS}`}>
              {view === "fulfillment" && grandTotal != null ? (
                <p>{tr("grandTotal", { amount: grandTotal.toFixed(2) })}</p>
              ) : null}
              {bonusBuckets ? (
                <>
                  <p>
                    {tr("bonusInHouse", {
                      base: bonusBuckets.inHouse.toFixed(2),
                      percent: bonusBuckets.pctInHouse,
                      bonus: bonusBuckets.bonusInHouse.toFixed(2),
                    })}
                  </p>
                  <p>
                    {tr("bonusWalkIn", {
                      base: bonusBuckets.walkIn.toFixed(2),
                      percent: bonusBuckets.pctWalkIn,
                      bonus: bonusBuckets.bonusWalkIn.toFixed(2),
                    })}
                  </p>
                  <p className="font-medium">
                    {tr("bonusTotal", { amount: bonusBuckets.bonusTotal.toFixed(2) })}
                  </p>
                </>
              ) : null}
            </div>
          ) : null
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                {view === "fulfillment" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colProcedure")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colPackageAssigned")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colPackageCompleted")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraAssigned")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraCompleted")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colExtraAmount")}</th>
                  </>
                ) : view === "doctor-bonus" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colProcedure")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colQty")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colPrice")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colTotal")}</th>
                  </>
                ) : (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colDate")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colProcedure")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colQty")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tableItems.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={colSpan}>
                    {tr("empty")}
                  </td>
                </tr>
              ) : (
                pagedItems.map((it: any, idx: number) => {
                  if (view === "fulfillment") {
                    const row = it as FulfillmentItem;
                    return (
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
                    );
                  }
                  if (view === "doctor-bonus") {
                    const row = it as DoctorBonusItem;
                    return (
                      <tr key={idx} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.procedure.code} — {row.procedure.name}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.price}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.totalAmount}</td>
                      </tr>
                    );
                  }
                  const row = it as NurseWorkItem;
                  return (
                    <tr key={idx} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.ymd}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureCode}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={tableItems.length}
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

