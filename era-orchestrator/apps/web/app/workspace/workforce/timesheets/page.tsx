"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

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
  orgUnit?: { name: string } | null;
  position?: { name: string } | null;
};

type TsEntry = {
  id: string;
  employmentId: string;
  workDate: string;
  type: EntryType;
  hours: string;
  lockedFromAbsence: boolean;
  status?: "DRAFT" | "APPROVED";
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

export default function TimesheetsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceTimesheets");
  const locale = useLocale();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [timesheet, setTimesheet] = useState<Ts | null>(null);
  const [employments, setEmployments] = useState<EmpRow[]>([]);
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

  const lastDay = useMemo(() => lastDayUtc(year, month), [year, month]);
  const yearMonth = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}`,
    [year, month],
  );
  const canEdit = timesheet?.status === "DRAFT";

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

  const empOptions = useMemo(
    () =>
      employments.map((e) => ({
        value: e.id,
        label:
          persons[e.globalPersonId]?.displayName ?? e.globalPersonId.slice(0, 8),
      })),
    [employments, persons],
  );

  const applyPayload = useCallback(
    (j: {
      timesheet: Ts;
      employments: EmpRow[];
      persons?: Record<string, Person>;
      entries: TsEntry[];
    }) => {
      setTimesheet(j.timesheet);
      setEmployments(j.employments ?? []);
      setPersons(j.persons ?? {});
      setEntries(j.entries ?? []);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch(`timesheets?year=${year}&month=${month}`);
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
  }, [year, month, t, applyPayload]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

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
      applyPayload((await res.json()) as Parameters<typeof applyPayload>[0]);
    } finally {
      if (globalBusy) setBusy(false);
    }
  }

  async function setCellType(
    employmentId: string,
    day: number,
    type: EntryType,
    optimistic?: boolean,
  ) {
    const key = `${employmentId}|${isoDay(year, month, day)}`;
    setCellBusyKey(key);
    if (optimistic) {
      setEntries((prev) => {
        const rest = prev.filter(
          (e) => !(e.employmentId === employmentId && String(e.workDate).slice(0, 10) === isoDay(year, month, day)),
        );
        const existing = prev.find(
          (e) => e.employmentId === employmentId && String(e.workDate).slice(0, 10) === isoDay(year, month, day),
        );
        return [
          ...rest,
          {
            id: existing?.id ?? `tmp-${key}`,
            employmentId,
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
            batches: [{ employmentId, fromDay: day, toDay: day, type }],
          }),
        },
        { globalBusy: false },
      );
    } finally {
      setCellBusyKey(null);
    }
  }

  function cycleCell(employmentId: string, day: number, current?: TsEntry) {
    if (!canEdit || current?.lockedFromAbsence || current?.status === "APPROVED") {
      return;
    }
    const cellKey = `${employmentId}|${isoDay(year, month, day)}`;
    if (busy || cellBusyKey === cellKey) return;
    if (!current) {
      void setCellType(employmentId, day, "WORK", true);
      return;
    }
    const idx = ENTRY_ORDER.indexOf(current.type);
    const next = ENTRY_ORDER[(idx + 1) % ENTRY_ORDER.length];
    void setCellType(employmentId, day, next, true);
  }

  async function runBatch() {
    if (!batchEmp) return;
    if (batchFrom < 1 || batchTo < batchFrom || batchTo > lastDay) {
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
  }

  async function runApprove() {
    if (!window.confirm(t("confirmApprove"))) return;
    await mutate("approve", { method: "POST", body: "{}" });
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        leading={
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[13px] font-medium text-[#34495E]">
              <span>{t("monthFilter")}</span>
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!/^\d{4}-\d{2}$/.test(v)) return;
                  setYear(Number(v.slice(0, 4)));
                  setMonth(Number(v.slice(5, 7)));
                }}
                className="rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              />
            </label>
            <p className="m-0 text-sm text-[#7F8C8D]">
              {t("status")}:{" "}
              <span className="font-medium text-[#34495E]">
                {timesheet
                  ? timesheet.status === "APPROVED"
                    ? t("statusApproved")
                    : t("statusDraft")
                  : "—"}
              </span>
            </p>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !canEdit || !timesheet}
              onClick={() => void mutate("autofill", { method: "POST", body: "{}" })}
            >
              {t("autofill")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy || !canEdit || !timesheet}
              onClick={() =>
                void mutate("sync-absences", { method: "POST", body: "{}" })
              }
            >
              {t("syncAbsences")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !canEdit || !timesheet}
              onClick={() => void runApprove()}
            >
              {t("approve")}
            </button>
          </div>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : timesheet ? (
        <>
          <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t("batchTitle")}</h2>
            <div className="flex flex-wrap items-end gap-3">
              <CatalogField
                kind="ENTITY_REF"
                label={t("batchEmployee")}
                value={batchEmp}
                onChange={(next) => setBatchEmp(String(next))}
                options={empOptions}
              />
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("batchFrom")}
                <input
                  type="number"
                  min={1}
                  max={lastDay}
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
                  max={lastDay}
                  className="mt-1 block w-20 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                  value={batchTo}
                  onChange={(e) => setBatchTo(Number(e.target.value))}
                  disabled={!canEdit}
                />
              </label>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("batchType")}
                value={batchType}
                onChange={(next) => setBatchType(String(next) as EntryType)}
                options={typeOptions}
              />
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !canEdit || !batchEmp}
                onClick={() => void runBatch()}
              >
                {t("batchApply")}
              </button>
            </div>
            <p className="text-xs text-[#7F8C8D]">{t("legendHint")}</p>
          </section>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-max border-collapse`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th
                    className={`sticky left-0 z-20 min-w-[140px] border-r border-[#D5DADF] bg-[#F8FAFC] ${DATA_TABLE_TH_LEFT_CLASS}`}
                  >
                    {t("colPerson")}
                  </th>
                  {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => (
                    <th
                      key={d}
                      className="min-w-[36px] border-l border-[#D5DADF] bg-[#F8FAFC] py-1 text-center text-[11px] font-semibold text-[#34495E]"
                    >
                      <div className="text-[10px] font-normal text-[#7F8C8D]">
                        {weekdayShortUtc(year, month, d, locale)}
                      </div>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employments.map((emp) => (
                  <tr key={emp.id} className={`${DATA_TABLE_TR_CLASS} group`}>
                    <td
                      className={`sticky left-0 z-10 whitespace-nowrap border-r border-[#D5DADF] bg-white font-semibold group-hover:bg-[#F1F5F9] ${DATA_TABLE_TD_CLASS}`}
                    >
                      {persons[emp.globalPersonId]?.displayName ??
                        emp.globalPersonId.slice(0, 8)}
                    </td>
                    {Array.from({ length: lastDay }, (_, i) => i + 1).map((d) => {
                      const dayIso = isoDay(year, month, d);
                      const e = entryMap.get(`${emp.id}|${dayIso}`);
                      const locked = e?.lockedFromAbsence;
                      const approved = e?.status === "APPROVED";
                      const typ = e?.type ?? null;
                      const cellKey = `${emp.id}|${dayIso}`;
                      const cellBusy = cellBusyKey === cellKey;
                      const disabled =
                        !canEdit || Boolean(locked) || Boolean(approved) || busy || cellBusy;
                      return (
                        <td
                          key={d}
                          className="border-l border-[#D5DADF] p-0 text-center text-[13px]"
                        >
                          <button
                            type="button"
                            title={
                              locked
                                ? t("absenceLocked")
                                : approved
                                  ? t("cellApproved")
                                  : cellCode(typ)
                            }
                            disabled={disabled}
                            onClick={() => cycleCell(emp.id, d, e)}
                            className={`min-h-[32px] w-full px-0.5 py-1 font-bold leading-none ${
                              locked || approved
                                ? "cursor-not-allowed bg-amber-50 text-amber-900"
                                : canEdit
                                  ? "cursor-pointer hover:bg-[#EAF2F8]"
                                  : "cursor-default"
                            }`}
                          >
                            {cellCode(typ)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {employments.length === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#7F8C8D]">
            <span>
              <strong>{t("codeEmpty")}</strong> — {t("typeEmpty")}
            </span>
            <span>
              <strong>{t("codeWork")}</strong> — {t("type.WORK")}
            </span>
            <span>
              <strong>{t("codeVacation")}</strong> — {t("type.VACATION")}
            </span>
            <span>
              <strong>{t("codeSick")}</strong> — {t("type.SICK")}
            </span>
            <span>
              <strong>{t("codeOff")}</strong> — {t("type.OFF")}
            </span>
            <span>
              <strong>{t("codeTrip")}</strong> — {t("type.BUSINESS_TRIP")}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
