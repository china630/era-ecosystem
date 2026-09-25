"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  DEFAULT_LIST_PAGE_SIZE,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";
import { WorkforceConfirmDialog } from "../../../../components/workspace/workforce-confirm-dialog";

type EntryType = "WORK" | "VACATION" | "SICK" | "OFF" | "BUSINESS_TRIP";

type Ts = {
  id: string;
  year: number;
  month: number;
  status: "DRAFT" | "APPROVED";
};

type EmpRow = {
  id: string;
  globalPersonId: string;
  orgUnit?: { id: string; name: string } | null;
  position?: { name: string } | null;
};

type EmpOpt = {
  id: string;
  globalPersonId: string;
  orgUnitId?: string | null;
};

type OrgUnitOpt = { id: string; name: string };

type TsEntry = {
  id: string;
  employmentId: string;
  workDate: string;
  type: EntryType;
  hours: string;
  lockedFromAbsence: boolean;
  status?: "DRAFT" | "APPROVED";
  source?: string;
};

type Person = {
  displayName: string | null;
  accessDenied: boolean;
};

const ENTRY_ORDER: EntryType[] = [
  "WORK",
  "VACATION",
  "SICK",
  "OFF",
  "BUSINESS_TRIP",
];

function isoDay(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDayUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayShortUtc(
  year: number,
  month: number,
  day: number,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function isWeekendUtc(year: number, month: number, day: number): boolean {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 || dow === 6;
}

function todayIsoBaku(): string {
  return todayBakuYmd();
}

function personName(
  persons: Record<string, Person>,
  globalPersonId: string,
  unnamed: string,
): string {
  const n = persons[globalPersonId]?.displayName?.trim();
  return n || unnamed;
}

function bakuYearMonth(): { year: number; month: number; iso: string } {
  const iso = todayIsoBaku();
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    iso,
  };
}

export default function TimesheetsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceTimesheets");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const bakuNow = bakuYearMonth();
  const [year, setYear] = useState(bakuNow.year);
  const [month, setMonth] = useState(bakuNow.month);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [employmentId, setEmploymentId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [employmentTotal, setEmploymentTotal] = useState(0);
  const [timesheet, setTimesheet] = useState<Ts | null>(null);
  const [employments, setEmployments] = useState<EmpRow[]>([]);
  const [employmentOptions, setEmploymentOptions] = useState<EmpOpt[]>([]);
  const [orgUnitOptions, setOrgUnitOptions] = useState<OrgUnitOpt[]>([]);
  const [persons, setPersons] = useState<Record<string, Person>>({});
  const [entries, setEntries] = useState<TsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cellBusyKey, setCellBusyKey] = useState<string | null>(null);
  const [batchEmp, setBatchEmp] = useState("");
  const [batchFrom, setBatchFrom] = useState(1);
  const [batchTo, setBatchTo] = useState(1);
  const [batchType, setBatchType] = useState<EntryType>("VACATION");
  const [batchOpen, setBatchOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cellPick, setCellPick] = useState<{
    employmentId: string;
    day: number;
    current?: TsEntry;
  } | null>(null);
  const [pastConfirm, setPastConfirm] = useState<{
    employmentId: string;
    day: number;
    type: EntryType;
  } | null>(null);

  const lastDay = useMemo(() => lastDayUtc(year, month), [year, month]);
  const yearMonth = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}`,
    [year, month],
  );
  const todayIso = todayIsoBaku();
  const editableLastDay = useMemo(() => {
    const todayYm = todayIso.slice(0, 7);
    if (yearMonth > todayYm) return 0;
    if (yearMonth < todayYm) return lastDay;
    return Math.min(lastDay, Number(todayIso.slice(8, 10)));
  }, [yearMonth, todayIso, lastDay]);
  const canEdit = timesheet?.status === "DRAFT";
  const unnamed = tCommon("unnamedPerson");

  const entryMap = useMemo(() => {
    const m = new Map<string, TsEntry>();
    for (const e of entries) {
      m.set(`${e.employmentId}|${String(e.workDate).slice(0, 10)}`, e);
    }
    return m;
  }, [entries]);

  const typeOptions = useMemo(
    () =>
      ENTRY_ORDER.map((v) => ({
        value: v,
        label: t(`type.${v}` as "type.WORK"),
      })),
    [t],
  );

  const orgFilterOptions = useMemo(
    () => orgUnitOptions.map((u) => ({ value: u.id, label: u.name })),
    [orgUnitOptions],
  );

  const empFilterOptions = useMemo(
    () =>
      employmentOptions.map((e) => ({
        value: e.id,
        label: personName(persons, e.globalPersonId, unnamed),
      })),
    [employmentOptions, persons, unnamed],
  );

  const empOptions = empFilterOptions;

  const applyPayload = useCallback(
    (j: {
      timesheet: Ts;
      employments: EmpRow[];
      persons?: Record<string, Person>;
      entries: TsEntry[];
      employmentOptions?: EmpOpt[];
      orgUnitOptions?: OrgUnitOpt[];
      employmentTotal?: number;
      page?: number;
      pageSize?: number;
    }) => {
      setTimesheet(j.timesheet);
      setEmployments(j.employments ?? []);
      setPersons(j.persons ?? {});
      setEntries(j.entries ?? []);
      if (j.employmentOptions) setEmploymentOptions(j.employmentOptions);
      if (j.orgUnitOptions) setOrgUnitOptions(j.orgUnitOptions);
      if (typeof j.employmentTotal === "number") setEmploymentTotal(j.employmentTotal);
    },
    [],
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
      page: String(page),
      pageSize: String(pageSize),
    });
    if (orgUnitId) qs.set("orgUnitId", orgUnitId);
    if (employmentId) qs.set("employmentId", employmentId);
    const res = await workforceFetch(`timesheets?${qs.toString()}`);
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setTimesheet(null);
      setEmployments([]);
      setEntries([]);
      setLoading(false);
      return;
    }
    applyPayload((await res.json()) as Parameters<typeof applyPayload>[0]);
    setLoading(false);
  }, [year, month, page, pageSize, orgUnitId, employmentId, t, applyPayload]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (employments[0] && !batchEmp) setBatchEmp(employments[0].id);
  }, [employments, batchEmp]);

  function cellCode(typ: EntryType | null): string {
    if (!typ) return t("codeEmpty");
    if (typ === "WORK") return t("codeWork");
    if (typ === "VACATION") return t("codeVacation");
    if (typ === "SICK") return t("codeSick");
    if (typ === "OFF") return t("codeOff");
    return t("codeTrip");
  }

  async function mutate(path: string, init: RequestInit, opts?: { globalBusy?: boolean }) {
    if (!timesheet) return;
    const globalBusy = opts?.globalBusy !== false;
    if (globalBusy) setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch(`timesheets/${timesheet.id}/${path}`, init);
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      await load({ silent: true });
    } finally {
      if (globalBusy) setBusy(false);
    }
  }

  async function setCellType(
    employmentIdCell: string,
    day: number,
    type: EntryType,
    optimistic?: boolean,
  ) {
    if (isoDay(year, month, day) > todayIsoBaku()) return;
    const key = `${employmentIdCell}|${isoDay(year, month, day)}`;
    setCellBusyKey(key);
    if (optimistic) {
      setEntries((prev) => {
        const rest = prev.filter(
          (e) =>
            !(
              e.employmentId === employmentIdCell &&
              String(e.workDate).slice(0, 10) === isoDay(year, month, day)
            ),
        );
        const existing = prev.find(
          (e) =>
            e.employmentId === employmentIdCell &&
            String(e.workDate).slice(0, 10) === isoDay(year, month, day),
        );
        return [
          ...rest,
          {
            id: existing?.id ?? `tmp-${key}`,
            employmentId: employmentIdCell,
            workDate: isoDay(year, month, day),
            type,
            hours: type === "OFF" ? "0" : "8",
            lockedFromAbsence: false,
            status: "DRAFT",
          },
        ];
      });
    }
    try {
      await mutate(
        "entries/batch",
        {
          method: "PATCH",
          body: JSON.stringify({
            batches: [{ employmentId: employmentIdCell, fromDay: day, toDay: day, type }],
          }),
        },
        { globalBusy: false },
      );
    } finally {
      setCellBusyKey(null);
    }
  }

  function applyCellType(employmentIdCell: string, day: number, type: EntryType) {
    void setCellType(employmentIdCell, day, type, true);
  }

  function chooseCellType(type: EntryType) {
    if (!cellPick) return;
    const iso = isoDay(year, month, cellPick.day);
    const pick = cellPick;
    setCellPick(null);
    if (iso > todayIso) return;
    if (iso < todayIso) {
      setPastConfirm({ employmentId: pick.employmentId, day: pick.day, type });
      return;
    }
    applyCellType(pick.employmentId, pick.day, type);
  }

  async function runBatch() {
    if (!batchEmp) return;
    const maxDay = editableLastDay || 0;
    if (maxDay < 1) {
      setError(t("futureLocked"));
      return;
    }
    if (batchFrom < 1 || batchTo < batchFrom || batchTo > maxDay) {
      setError(t("batchRangeErr"));
      return;
    }
    await mutate("entries/batch", {
      method: "PATCH",
      body: JSON.stringify({
        batches: [
          {
            employmentId: batchEmp,
            fromDay: batchFrom,
            toDay: batchTo,
            type: batchType,
          },
        ],
      }),
    });
    setBatchOpen(false);
  }

  async function runApprove() {
    setApproveOpen(false);
    await mutate("approve", { method: "POST", body: "{}" });
  }

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        disabled={busy || !canEdit || !timesheet || editableLastDay < 1}
        onClick={() => setBatchOpen(true)}
      >
        {t("batchTitle")}
      </button>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={busy || !canEdit || !timesheet || editableLastDay < 1}
        onClick={() => setAutofillOpen(true)}
      >
        {t("autofill")}
      </button>
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        disabled={busy || !canEdit || !timesheet}
        onClick={() => void mutate("sync-absences", { method: "POST", body: "{}" })}
      >
        {t("syncAbsences")}
      </button>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={busy || !canEdit || !timesheet}
        onClick={() => setApproveOpen(true)}
      >
        {t("approve")}
      </button>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => setFullscreen((v) => !v)}
      >
        {fullscreen ? (
          <>
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            {t("exitFullscreen")}
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            {t("enterFullscreen")}
          </>
        )}
      </button>
    </div>
  );

  const filters = (
    <EraListFilterBar
      resetLabel={tCommon("filterReset")}
      onReset={() => {
        const n = bakuYearMonth();
        setYear(n.year);
        setMonth(n.month);
        setOrgUnitId("");
        setEmploymentId("");
        setPage(1);
      }}
    >
      <label className="text-[13px] font-medium text-[#34495E]">
        {t("monthFilter")}
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => {
            const v = e.target.value;
            if (!/^\d{4}-\d{2}$/.test(v)) return;
            setYear(Number(v.slice(0, 4)));
            setMonth(Number(v.slice(5, 7)));
            setPage(1);
          }}
          className="mt-1 block rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
        />
      </label>
      <CatalogField
        kind={orgFilterOptions.length > 12 ? "SEARCHABLE" : "CLOSED_SMALL"}
        label={t("filterOrgUnit")}
        value={orgUnitId}
        onChange={(next) => {
          setOrgUnitId(String(next));
          setEmploymentId("");
          setPage(1);
        }}
        options={orgFilterOptions}
        emptyLabel={t("allOrgUnits")}
      />
      <CatalogField
        kind="ENTITY_REF"
        label={t("filterEmployee")}
        value={employmentId}
        onChange={(next) => {
          setEmploymentId(String(next));
          setPage(1);
        }}
        options={empFilterOptions}
        emptyLabel={t("allEmployees")}
      />
      <p className="self-end pb-1.5 text-sm text-[#7F8C8D]">
        {t("status")}:{" "}
        <span className="font-medium text-[#34495E]">
          {timesheet
            ? timesheet.status === "APPROVED"
              ? t("statusApproved")
              : t("statusDraft")
            : "—"}
        </span>
      </p>
    </EraListFilterBar>
  );

  const grid = timesheet ? (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7F8C8D]">
        <span>
          <strong className="text-[#34495E]">{t("codeEmpty")}</strong> {t("typeEmpty")}
        </span>
        <span>
          <strong className="text-[#34495E]">{t("codeWork")}</strong> {t("type.WORK")}
        </span>
        <span>
          <strong className="text-[#34495E]">{t("codeVacation")}</strong> {t("type.VACATION")}
        </span>
        <span>
          <strong className="text-[#34495E]">{t("codeSick")}</strong> {t("type.SICK")}
        </span>
        <span>
          <strong className="text-[#34495E]">{t("codeOff")}</strong> {t("type.OFF")}
        </span>
        <span>
          <strong className="text-[#34495E]">{t("codeTrip")}</strong> {t("type.BUSINESS_TRIP")}
        </span>
      </div>
      <p className="text-xs text-[#7F8C8D]">{t("legendHint")}</p>
      {yearMonth > todayIso.slice(0, 7) ? (
        <p className="text-sm text-[#7F8C8D]">{t("futureMonthHint")}</p>
      ) : null}
      {lastDay < 1 ? null : (
        <div
          className={
            fullscreen
              ? "min-h-0 flex-1 overflow-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm"
              : DATA_TABLE_VIEWPORT_CLASS
          }
        >
          <table className={`${DATA_TABLE_CLASS} min-w-max border-collapse`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th
                  className={`sticky left-0 z-20 min-w-[140px] border-r border-[#D5DADF] bg-[#F8FAFC] ${DATA_TABLE_TH_LEFT_CLASS}`}
                >
                  {t("colPerson")}
                </th>
                {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => {
                  const dayIso = isoDay(year, month, d);
                  const isToday = dayIso === todayIso;
                  const future = dayIso > todayIso;
                  const weekend = isWeekendUtc(year, month, d);
                  return (
                    <th
                      key={d}
                      className={`min-w-[36px] border-l border-[#D5DADF] py-1 text-center text-[11px] font-semibold text-[#34495E] ${
                        isToday
                          ? "bg-[#FDECEC]"
                          : future
                            ? "bg-[#F4F6F8] text-[#94A3B8]"
                            : weekend
                              ? "bg-[#EEF2F6]"
                              : "bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="text-[10px] font-normal text-[#7F8C8D]">
                        {weekdayShortUtc(year, month, d, locale)}
                      </div>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employments.map((emp) => (
                <tr key={emp.id} className={`${DATA_TABLE_TR_CLASS} group`}>
                  <td
                    className={`sticky left-0 z-10 whitespace-nowrap border-r border-[#D5DADF] bg-white font-semibold group-hover:bg-[#F1F5F9] ${DATA_TABLE_TD_CLASS}`}
                  >
                    {personName(persons, emp.globalPersonId, unnamed)}
                    {emp.orgUnit?.name ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-[#7F8C8D]">
                        {emp.orgUnit.name}
                      </span>
                    ) : null}
                  </td>
                  {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => {
                    const dayIso = isoDay(year, month, d);
                    const isToday = dayIso === todayIso;
                    const future = dayIso > todayIso;
                    const weekend = isWeekendUtc(year, month, d);
                    const e = entryMap.get(`${emp.id}|${dayIso}`);
                    const locked = Boolean(e?.lockedFromAbsence);
                    const approved = e?.status === "APPROVED";
                    const futurePlan = future && !locked && !approved;
                    const typ = futurePlan ? null : (e?.type ?? null);
                    const src = futurePlan ? "ops_grid" : (e?.source ?? "ops_grid");
                    const srcBadge =
                      src === "faceid"
                        ? t("sourceFaceid")
                        : src === "roster_plan"
                          ? t("sourceRoster")
                          : src === "ops_grid" || !e
                            ? null
                            : t("sourceOps");
                    const cellKey = `${emp.id}|${dayIso}`;
                    const cellBusy = cellBusyKey === cellKey;
                    const disabled =
                      future ||
                      !canEdit ||
                      locked ||
                      Boolean(approved) ||
                      busy ||
                      cellBusy;
                    const tint = isToday
                      ? "bg-[#FDECEC]"
                      : locked || approved
                        ? ""
                        : future
                          ? "bg-[#F8FAFC]"
                          : weekend
                            ? "bg-[#F4F6F8]"
                            : "";
                    return (
                      <td
                        key={d}
                        className={`border-l border-[#D5DADF] p-0 text-center text-[13px] ${tint}`}
                      >
                        <button
                          type="button"
                          title={
                            locked
                              ? t("absenceLocked")
                              : future
                                ? t("futureLocked")
                                : approved
                                  ? t("cellApproved")
                                  : isToday
                                    ? t("todayHint")
                                    : [cellCode(typ), srcBadge].filter(Boolean).join(" · ")
                          }
                          disabled={disabled}
                          onClick={() =>
                            setCellPick({ employmentId: emp.id, day: d, current: e })
                          }
                          className={`min-h-[32px] w-full px-0.5 py-1 font-bold leading-none ${
                            locked || approved
                              ? "cursor-not-allowed bg-amber-50 text-amber-900"
                              : future
                                ? "cursor-not-allowed text-[#94A3B8]"
                                : canEdit
                                  ? "cursor-pointer hover:bg-[#EAF2F8]"
                                  : "cursor-default"
                          }`}
                        >
                          <span className="block">{cellCode(typ)}</span>
                          {src === "faceid" ? (
                            <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#0B6E99]">
                              {t("sourceFaceid")}
                            </span>
                          ) : src === "roster_plan" ? (
                            <span className="block text-[9px] font-medium text-[#64748B]">
                              {t("sourceRoster")}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {employments.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
      ) : (
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={employmentTotal}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      )}
    </>
  ) : null;

  const modals = (
    <>
      <ModalShell
        open={batchOpen}
        title={t("batchTitle")}
        onClose={() => setBatchOpen(false)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-lg"
        footer={
          <ModalFooter
            onCancel={() => setBatchOpen(false)}
            onSubmit={() => void runBatch()}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("batchApply")}
            busy={busy}
            submitDisabled={!canEdit || !batchEmp || editableLastDay < 1}
          />
        }
      >
        <div className="grid gap-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t("batchEmployee")}
            value={batchEmp}
            onChange={(next) => setBatchEmp(String(next))}
            options={empOptions}
          />
          <div className="flex flex-wrap gap-3">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("batchFrom")}
              <input
                type="number"
                min={1}
                max={editableLastDay || 1}
                className="mt-1 block w-20 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={batchFrom}
                onChange={(e) => setBatchFrom(Number(e.target.value))}
                disabled={!canEdit}
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("batchTo")}
              <input
                type="number"
                min={1}
                max={editableLastDay || 1}
                className="mt-1 block w-20 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={batchTo}
                onChange={(e) => setBatchTo(Number(e.target.value))}
                disabled={!canEdit}
              />
            </label>
          </div>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("batchType")}
            value={batchType}
            onChange={(next) => setBatchType(String(next) as EntryType)}
            options={typeOptions}
          />
        </div>
      </ModalShell>

      <WorkforceConfirmDialog
        open={pastConfirm !== null}
        title={t("pickCellType")}
        body={t("confirmPastDay")}
        confirmLabel={tCommon("confirm")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setPastConfirm(null)}
        onConfirm={() => {
          const next = pastConfirm;
          setPastConfirm(null);
          if (next) applyCellType(next.employmentId, next.day, next.type);
        }}
      />
      <ModalShell
        open={cellPick !== null}
        title={t("pickCellType")}
        onClose={() => setCellPick(null)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-sm"
      >
        <div className="grid gap-2">
          {ENTRY_ORDER.map((v) => (
            <button
              key={v}
              type="button"
              className={
                cellPick?.current?.type === v
                  ? PRIMARY_BUTTON_CLASS
                  : SECONDARY_BUTTON_CLASS
              }
              onClick={() => chooseCellType(v)}
            >
              {t(`type.${v}` as "type.WORK")}
            </button>
          ))}
        </div>
      </ModalShell>
      <WorkforceConfirmDialog
        open={autofillOpen}
        title={t("autofill")}
        body={t("autofillConfirm")}
        confirmLabel={tCommon("confirm")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setAutofillOpen(false)}
        onConfirm={() => {
          setAutofillOpen(false);
          void mutate("autofill", { method: "POST", body: "{}" });
        }}
      />
      <ModalShell
        open={approveOpen}
        title={t("approve")}
        onClose={() => setApproveOpen(false)}
        closeLabel={tCommon("close")}
        maxWidthClass="max-w-sm"
        footer={
          <ModalFooter
            onCancel={() => setApproveOpen(false)}
            onSubmit={() => void runApprove()}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("approve")}
            busy={busy}
          />
        }
      >
        <p className="text-sm text-[#34495E]">{t("confirmApprove")}</p>
      </ModalShell>
    </>
  );

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  if (fullscreen) {
    return (
      <>
        <div
          className="fixed inset-0 z-[180] flex flex-col bg-[#EBEDF0] px-4 py-3 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("fullscreenTitle")}
        >
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerActions}
          </div>
          <div className="shrink-0">{filters}</div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div
            className={`${CARD_CONTAINER_CLASS} mt-3 flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden p-4`}
          >
            {loading ? (
              <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
            ) : (
              grid
            )}
          </div>
        </div>
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={headerActions} />
      {filters}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : grid}
      {modals}
    </div>
  );
}
