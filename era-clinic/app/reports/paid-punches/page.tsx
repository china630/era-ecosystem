"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  showApiError,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@/lib/baku-day";

type PunchKind = "" | "procedure" | "lab" | "diagnostic";

type PunchRow = {
  id: string;
  kind: Exclude<PunchKind, "">;
  ymd: string;
  code: string;
  name: string;
  room: string;
  guest: string;
  doctor: string;
  cashier: string;
  amount: number;
};

function monthStartBaku() {
  return `${todayBakuYmd().slice(0, 8)}01`;
}

export default function PaidPunchReportPage() {
  const t = useTranslations("common");
  const tr = useTranslations("paidPunchReport");
  const tc = useTranslations("nav");
  const locale = useLocale();

  const [from, setFrom] = useState(monthStartBaku());
  const [to, setTo] = useState(todayBakuYmd());
  const [kind, setKind] = useState<PunchKind>("");
  const [room, setRoom] = useState("");
  const [guest, setGuest] = useState("");
  const [code, setCode] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [services, setServices] = useState<Array<{ value: string; label: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [cashiers, setCashiers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [items, setItems] = useState<PunchRow[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const url = useMemo(() => {
    const params = new URLSearchParams({ from, to, locale });
    if (kind) params.set("kind", kind);
    if (room.trim()) params.set("room", room.trim());
    if (guest.trim()) params.set("guest", guest.trim());
    if (code) params.set("code", code);
    if (doctorId) params.set("doctorId", doctorId);
    if (cashierId) params.set("cashierId", cashierId);
    return `/api/reports/paid-punches?${params.toString()}`;
  }, [from, to, locale, kind, room, guest, code, doctorId, cashierId]);

  useEffect(() => {
    setPage(1);
  }, [url, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/procedure-types?locale=${encodeURIComponent(locale)}`).then((res) =>
        res.ok ? res.json() : null,
      ),
      fetch(`/api/diagnostic-catalog?applyFavorites=false&locale=${encodeURIComponent(locale)}`).then(
        (res) => (res.ok ? res.json() : null),
      ),
    ]).then(([procedures, catalog]) => {
      if (cancelled) return;
      const options: Array<{ value: string; label: string }> = [];
      const seen = new Set<string>();
      const procedureRows = (procedures?.data ?? procedures) as Array<{ code?: string; name?: string }>;
      if (Array.isArray(procedureRows)) {
        for (const row of procedureRows) {
          if (!row.code || seen.has(row.code)) continue;
          seen.add(row.code);
          options.push({
            value: row.code,
            label: row.name ? `${row.name} (${row.code})` : row.code,
          });
        }
      }
      const catalogBody = (catalog?.data ?? catalog) as {
        items?: Array<{ code?: string; title?: Record<string, string> }>;
      };
      for (const row of catalogBody.items ?? []) {
        if (!row.code || seen.has(row.code)) continue;
        seen.add(row.code);
        const title = row.title?.[locale] || row.title?.en || row.code;
        options.push({ value: row.code, label: `${title} (${row.code})` });
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      setServices(options);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/reports/procedures/doctors")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const payload = (raw.data ?? raw) as { items?: Array<{ id: string; fullName?: string }> };
        setDoctors(
          (payload.items ?? []).map((row) => ({ id: row.id, fullName: row.fullName ?? row.id })),
        );
      });
    void fetch("/api/reports/paid-punches/cashiers")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const payload = (raw.data ?? raw) as { items?: Array<{ id: string; fullName?: string }> };
        setCashiers(
          (payload.items ?? []).map((row) => ({ id: row.id, fullName: row.fullName ?? row.id })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as {
          data?: { items?: PunchRow[]; grandTotal?: number };
          items?: PunchRow[];
          grandTotal?: number;
          error?: string;
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

  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  const kindLabel = (value: PunchRow["kind"]) =>
    value === "procedure" ? tr("kindProcedure") : value === "lab" ? tr("kindLab") : tr("kindDiagnostic");

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={tc("paidPunchReport")} subtitle={tr("subtitle")} />
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={t("filterReset")}
            onReset={() => {
              setFrom(monthStartBaku());
              setTo(todayBakuYmd());
              setKind("");
              setRoom("");
              setGuest("");
              setCode("");
              setDoctorId("");
              setCashierId("");
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
              kind="CLOSED_SMALL"
              label={tr("kind")}
              value={kind}
              onChange={(value) => setKind(String(value ?? "") as PunchKind)}
              emptyLabel={tr("kindAll")}
              options={[
                { value: "", label: tr("kindAll") },
                { value: "procedure", label: tr("kindProcedure") },
                { value: "lab", label: tr("kindLab") },
                { value: "diagnostic", label: tr("kindDiagnostic") },
              ]}
            />
            <CatalogField
              kind="FREE_TEXT"
              label={tr("room")}
              value={room}
              options={[]}
              onChange={(value) => setRoom(String(value ?? ""))}
            />
            <CatalogField
              kind="FREE_TEXT"
              label={tr("guest")}
              value={guest}
              options={[]}
              onChange={(value) => setGuest(String(value ?? ""))}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={tr("service")}
              value={code}
              onChange={(value) => setCode(String(value ?? ""))}
              options={[{ value: "", label: t("all") }, ...services]}
              emptyLabel={t("all")}
              widthPreset="selectWide"
            />
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
            <CatalogField
              kind="SEARCHABLE"
              label={tr("cashier")}
              value={cashierId}
              onChange={(value) => setCashierId(String(value ?? ""))}
              options={[
                { value: "", label: tr("allCashiers") },
                ...cashiers.map((row) => ({ value: row.id, label: row.fullName })),
              ]}
              emptyLabel={tr("allCashiers")}
              widthPreset="selectWide"
            />
          </EraListFilterBar>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("kind")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colService")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("room")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("guest")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("doctor")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("cashier")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tr("colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={8}>
                    {tr("empty")}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.ymd}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{kindLabel(row.kind)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.code} — {row.name}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.room}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.guest}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.doctor}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.cashier}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {grandTotal != null ? (
              <tfoot>
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={7}>
                    {tr("grandTotal", { amount: grandTotal.toFixed(2) })}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            ) : null}
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
