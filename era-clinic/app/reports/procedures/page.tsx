"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

type DoctorLinesItem = {
  procedure: { code: string; name: string };
  procedureDate: string;
  status: string;
  paid: string;
  origin: string;
  quantity: number;
  totalAmount: number;
};

type DoctorBonusItem = {
  procedure: { code: string; name: string };
  quantity: number;
  price: number;
  totalAmount: number;
};

type ByProcedureItem = {
  procedure: { code: string; name: string };
  assignedCount: number;
  completedCount: number;
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthAgoBaku() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function ProceduresReportPage() {
  const t = useTranslations("common");
  const tc = useTranslations("nav");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const canSelectNurse = auth?.role === "DOCTOR" || auth?.role === "CLINIC_ADMIN";

  const [view, setView] = useState<"doctor-lines" | "doctor-bonus" | "by-procedure" | "nurse-work">(
    "doctor-lines",
  );
  const [from, setFrom] = useState(monthAgoBaku());
  const [to, setTo] = useState(todayIsoBaku());
  const [procedure, setProcedure] = useState<string>("");
  const [paid, setPaid] = useState<"" | "paid" | "free">("");
  const [nurseId, setNurseId] = useState<string>("");
  const [nurses, setNurses] = useState<Array<{ id: string; fullName: string }>>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [view, from, to, procedure, paid, nurseId, pageSize]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      view,
      from,
      to,
      locale,
    });
    if (procedure) params.set("procedure", procedure);
    if (paid) params.set("paid", paid);
    if (view === "nurse-work" && nurseId) params.set("nurseId", nurseId);
    return `/api/reports/procedures?${params.toString()}`;
  }, [view, from, to, procedure, paid, nurseId, locale]);

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

  async function load() {
    setBusy(true);
    setMsg(null);
    setItems([]);
    setGrandTotal(null);
    setBonusBuckets(null);
    try {
      const res = await fetch(url);
      const d = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setMsg((d as { error?: string }).error ?? "Load failed");
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
      setMsg("Load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <>
      <PageHeader title={tc("procedureReport")} subtitle="Procedure reports" />
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            <span className={TEXT_MUTED_CLASS}>View</span>
            <select
              value={view}
              onChange={(e) =>
                setView(e.target.value as typeof view)
              }
              className="w-64 rounded border px-2 py-1"
            >
              <option value="doctor-lines">Doctor lines</option>
              <option value="doctor-bonus">Doctor bonus</option>
              <option value="by-procedure">By procedure</option>
              <option value="nurse-work">Nurse work</option>
            </select>
          </label>

          <label className="flex flex-col text-sm">
            <span className={TEXT_MUTED_CLASS}>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col text-sm">
            <span className={TEXT_MUTED_CLASS}>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1" />
          </label>

          <label className="flex flex-col text-sm">
            <span className={TEXT_MUTED_CLASS}>Procedure filter</span>
            <input value={procedure} onChange={(e) => setProcedure(e.target.value)} className="w-56 rounded border px-2 py-1" placeholder="code" />
          </label>

          <label className="flex flex-col text-sm">
            <span className={TEXT_MUTED_CLASS}>Paid</span>
            <select value={paid} onChange={(e) => setPaid(e.target.value as any)} className="w-40 rounded border px-2 py-1">
              <option value="">all</option>
              <option value="paid">paid</option>
              <option value="free">free</option>
            </select>
          </label>

          {view === "nurse-work" && canSelectNurse ? (
            <label className="flex flex-col text-sm">
              <span className={TEXT_MUTED_CLASS}>{t("nurse")}</span>
              <select value={nurseId} onChange={(e) => setNurseId(e.target.value)} className="w-56 rounded border px-2 py-1">
                <option value="">All nurses</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void load()}>
            {t("search")}
          </button>
        </div>

        {msg ? <p className={`mt-3 text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}

        <div className={`mt-4 ${DATA_TABLE_VIEWPORT_CLASS}`}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr>
                {view === "doctor-lines" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Procedure</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Date</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Status</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Paid</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Origin</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Qty</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Amount</th>
                  </>
                ) : view === "doctor-bonus" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Procedure</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Qty</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Price</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Total</th>
                  </>
                ) : view === "by-procedure" ? (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Procedure</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Assigned</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Completed</th>
                  </>
                ) : (
                  <>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Date</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Procedure</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>Qty</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={7}>
                    No data
                  </td>
                </tr>
              ) : (
                pagedItems.map((it: any, idx: number) => {
                  if (view === "doctor-lines") {
                    const row = it as DoctorLinesItem;
                    return (
                      <tr key={idx}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.procedure.code} — {row.procedure.name}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{new Date(row.procedureDate).toLocaleDateString()}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.paid}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.origin}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.totalAmount}</td>
                      </tr>
                    );
                  }
                  if (view === "doctor-bonus") {
                    const row = it as DoctorBonusItem;
                    return (
                      <tr key={idx}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.procedure.code} — {row.procedure.name}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.price}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.totalAmount}</td>
                      </tr>
                    );
                  }
                  if (view === "by-procedure") {
                    const row = it as ByProcedureItem;
                    return (
                      <tr key={idx}>
                        <td className={DATA_TABLE_TD_CLASS}>{row.procedure.code}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.assignedCount}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{row.completedCount}</td>
                      </tr>
                    );
                  }
                  const row = it as NurseWorkItem;
                  return (
                    <tr key={idx}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.ymd}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.procedureCode}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.quantity}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

        {grandTotal != null ? <p className="mt-3 text-sm">Grand total: {grandTotal}</p> : null}
        {bonusBuckets ? (
          <div className={`mt-2 space-y-1 text-sm ${TEXT_MUTED_CLASS}`}>
            <p>
              In-house extras base: {bonusBuckets.inHouse.toFixed(2)} AZN ×{" "}
              {bonusBuckets.pctInHouse}% = {bonusBuckets.bonusInHouse.toFixed(2)} AZN
            </p>
            <p>
              Walk-in extras base: {bonusBuckets.walkIn.toFixed(2)} AZN ×{" "}
              {bonusBuckets.pctWalkIn}% = {bonusBuckets.bonusWalkIn.toFixed(2)} AZN
            </p>
            <p className="font-medium text-[inherit]">
              Bonus total: {bonusBuckets.bonusTotal.toFixed(2)} AZN
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

