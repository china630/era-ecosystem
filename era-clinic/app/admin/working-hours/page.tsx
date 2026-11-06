"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
  DatePicker,
  FilterChips,
  FORM_STACK_CLASS,
  LINK_ACCENT_CLASS,
  LIST_PAGE_SHELL_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { ClinicDayPanel } from "@/components/admin/ClinicDayPanel";

type WorkHours = {
  dayStartHour: number;
  dayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
  shortenedDayStartHour: number;
  shortenedDayEndHour: number;
  closedWeekdays: number[];
  peakModeEnabled: boolean;
};

type ClinicDayRow = {
  ymd: string;
  kind: "working" | "short" | "closed";
  working: boolean;
  startHour: number;
  endHour: number;
  overridden: boolean;
};

type PeakRow = {
  id: string;
  fromYmd: string;
  toYmd: string;
  dayKind: "WORKING" | "SHORT";
  scope: "OWN_ONLY" | "EMPTY_DEFAULT" | "CLINIC_WIDE";
  startHour: number | null;
  endHour: number | null;
  note?: string | null;
};

type PeakDraft = {
  fromYmd: string;
  toYmd: string;
  dayKind: "WORKING" | "SHORT";
  scope: "OWN_ONLY" | "EMPTY_DEFAULT" | "CLINIC_WIDE";
  startHour: string;
  endHour: string;
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
/** Calendar header Mon→Sun (ISO order). */
const CAL_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const next =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to: next };
}

function hourOptions(from = 0, to = 24) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const h = from + i;
    return { value: String(h), label: `${String(h).padStart(2, "0")}:00` };
  });
}

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function WorkingHoursPage() {
  const t = useTranslations("adminWorkingHours");
  const ts = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [chip, setChip] = useState("schedule");
  const [work, setWork] = useState<WorkHours | null>(null);
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<ClinicDayRow[]>([]);
  const [calendarLoadError, setCalendarLoadError] = useState<string | null>(null);
  const [selectedYmd, setSelectedYmd] = useState("");
  const [dayKind, setDayKind] = useState<"WORKING" | "SHORT" | "CLOSED">("WORKING");
  const [dayStart, setDayStart] = useState("9");
  const [dayEnd, setDayEnd] = useState("17");

  const [peaks, setPeaks] = useState<PeakRow[]>([]);
  const [peaksLoadError, setPeaksLoadError] = useState<string | null>(null);
  const [peakOpen, setPeakOpen] = useState(false);
  const [peakDraft, setPeakDraft] = useState<PeakDraft>({
    fromYmd: "",
    toYmd: "",
    dayKind: "WORKING",
    scope: "OWN_ONLY",
    startHour: "",
    endHour: "",
  });

  const monthTitle = useMemo(() => {
    const d = new Date(Date.UTC(calYear, calMonth - 1, 1, 12));
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      d,
    );
  }, [calYear, calMonth, locale]);

  const loadSchedule = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    if (!res.ok) {
      setWork(null);
      setDraft(null);
      const detail =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : res.status === 403
              ? t("loadForbidden")
              : t("scheduleLoadError");
      setScheduleLoadError(detail);
      showApiError(data, t("title"));
      return;
    }
    setScheduleLoadError(null);
    const row = data.data ?? data;
    const next: WorkHours = {
      dayStartHour: row.dayStartHour ?? 9,
      dayEndHour: row.dayEndHour ?? 17,
      lunchStartHour: row.lunchStartHour ?? 13,
      lunchEndHour: row.lunchEndHour ?? 14,
      shortenedDayStartHour: row.shortenedDayStartHour ?? row.dayStartHour ?? 9,
      shortenedDayEndHour: row.shortenedDayEndHour ?? 13,
      closedWeekdays: row.closedWeekdays ?? [0],
      peakModeEnabled: Boolean(row.peakModeEnabled),
    };
    setWork(next);
    setDraft(next);
  }, [t]);

  const loadMonth = useCallback(async () => {
    const { from, to } = monthBounds(calYear, calMonth);
    const res = await fetch(`/api/admin/clinic-days?from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) {
      setDays([]);
      setSelectedYmd("");
      const detail =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : res.status === 403
              ? t("loadForbidden")
              : t("calendarLoadError");
      setCalendarLoadError(detail);
      showApiError(data, t("chipCalendar"));
      return;
    }
    setCalendarLoadError(null);
    setDays((data.data ?? data) as ClinicDayRow[]);
  }, [calYear, calMonth, t]);

  const loadPeaks = useCallback(async () => {
    const res = await fetch("/api/admin/peak-rules");
    const data = await res.json();
    if (!res.ok) {
      setPeaks([]);
      const detail =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : res.status === 403
              ? t("loadForbidden")
              : t("peaksLoadError");
      setPeaksLoadError(detail);
      showApiError(data, t("chipPeaks"));
      return;
    }
    setPeaksLoadError(null);
    setPeaks((data.data ?? data) as PeakRow[]);
  }, [t]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (chip === "calendar") void loadMonth();
  }, [chip, loadMonth]);

  useEffect(() => {
    if (chip === "peaks") void loadPeaks();
  }, [chip, loadPeaks]);

  const byYmd = useMemo(() => new Map(days.map((d) => [d.ymd, d])), [days]);

  async function saveSchedule() {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("saveSchedule"));
        return;
      }
      showSuccess(t("saved"));
      setEditSchedule(false);
      await loadSchedule();
    } finally {
      setBusy(false);
    }
  }

  function selectDay(ymd: string) {
    const row = byYmd.get(ymd);
    setSelectedYmd(ymd);
    if (!row) return;
    setDayKind(row.kind === "closed" ? "CLOSED" : row.kind === "short" ? "SHORT" : "WORKING");
    setDayStart(String(row.startHour || 9));
    setDayEnd(String(row.endHour || 17));
  }

  async function saveDay() {
    if (!selectedYmd) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clinic-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayYmd: selectedYmd,
          dayKind,
          startHour: dayKind === "CLOSED" ? null : Number(dayStart),
          endHour: dayKind === "CLOSED" ? null : Number(dayEnd),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, ts("clinicDaySaved"));
        return;
      }
      showSuccess(ts("clinicDaySaved"));
      await loadMonth();
    } finally {
      setBusy(false);
    }
  }

  async function savePeak() {
    setBusy(true);
    try {
      const needsHours = peakDraft.scope !== "OWN_ONLY";
      const res = await fetch("/api/admin/peak-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromYmd: peakDraft.fromYmd,
          toYmd: peakDraft.toYmd || peakDraft.fromYmd,
          dayKind: peakDraft.dayKind,
          scope: peakDraft.scope,
          startHour: needsHours && peakDraft.startHour ? Number(peakDraft.startHour) : null,
          endHour: needsHours && peakDraft.endHour ? Number(peakDraft.endHour) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("peakSave"));
        return;
      }
      showSuccess(t("saved"));
      setPeakOpen(false);
      await loadPeaks();
    } finally {
      setBusy(false);
    }
  }

  async function removePeak(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/peak-rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("peakDelete"));
        return;
      }
      showSuccess(t("saved"));
      await loadPeaks();
    } finally {
      setBusy(false);
    }
  }

  const calendarCells = useMemo(() => {
    const { from } = monthBounds(calYear, calMonth);
    const first = new Date(`${from}T12:00:00`);
    const startPad = (first.getDay() + 6) % 7;
    const cells: Array<{ ymd: string | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ ymd: null });
    for (const day of days) cells.push({ ymd: day.ymd });
    return cells;
  }, [calYear, calMonth, days]);

  const scheduleRows = work
    ? [
        { label: ts("dayStartHour"), value: formatHour(work.dayStartHour) },
        { label: ts("dayEndHour"), value: formatHour(work.dayEndHour) },
        {
          label: ts("lunchHours"),
          value: `${formatHour(work.lunchStartHour)} – ${formatHour(work.lunchEndHour)}`,
        },
        { label: t("shortenedDayStartHour"), value: formatHour(work.shortenedDayStartHour) },
        { label: ts("shortenedDayEndHour"), value: formatHour(work.shortenedDayEndHour) },
        {
          label: ts("closedWeekdays"),
          value:
            work.closedWeekdays.map((d) => ts(`weekday_${WEEKDAY_KEYS[d]}`)).join(", ") || "—",
        },
        {
          label: t("legacyPeakCards"),
          value: work.peakModeEnabled ? t("legacyPeakOn") : t("legacyPeakOff"),
        },
      ]
    : [];

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/admin/settings" className={SECONDARY_BUTTON_CLASS}>
            ← {tNav("settings")}
          </Link>
        }
      />
      <FilterChips
        ariaLabel={t("chips")}
        value={chip}
        onChange={setChip}
        alwaysVisibleIds={["schedule", "calendar", "peaks"]}
        items={[
          { id: "schedule", label: t("chipSchedule") },
          { id: "calendar", label: t("chipCalendar") },
          { id: "peaks", label: t("chipPeaks") },
        ]}
      />

      {chip === "schedule" ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          {scheduleLoadError ? (
            <div
              role="alert"
              className="rounded border border-[#E74C3C]/40 bg-[#FDEDEC] px-3 py-2 text-[13px] text-[#922B21]"
            >
              <p>{t("scheduleLoadError")}</p>
              <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>{scheduleLoadError}</p>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} mt-2`}
                onClick={() => void loadSchedule()}
              >
                {t("retryLoad")}
              </button>
            </div>
          ) : null}
          {!scheduleLoadError && work ? (
            <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-[#2C3E50]">{t("chipSchedule")}</h2>
            <button
              type="button"
              className={TABLE_ROW_ICON_BTN_CLASS}
              aria-label={tc("edit")}
              onClick={() => {
                setDraft(work);
                setEditSchedule(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("field")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("value")}</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.label} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{row.label}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("saturdayIsShort")}</p>
            </>
          ) : null}
        </section>
      ) : null}

      {chip === "calendar" ? (
        <section className="space-y-4">
          <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("prev")}
                onClick={() => {
                  if (calMonth === 1) {
                    setCalYear((y) => y - 1);
                    setCalMonth(12);
                  } else setCalMonth((m) => m - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-[10rem] text-center text-[13px] font-semibold capitalize text-[#2C3E50]">
                {monthTitle}
              </span>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc("next")}
                onClick={() => {
                  if (calMonth === 12) {
                    setCalYear((y) => y + 1);
                    setCalMonth(1);
                  } else setCalMonth((m) => m + 1);
                }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {calendarLoadError ? (
              <div
                role="alert"
                className="rounded border border-[#E74C3C]/40 bg-[#FDEDEC] px-3 py-2 text-[13px] text-[#922B21]"
              >
                <p>{t("calendarLoadError")}</p>
                <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>{calendarLoadError}</p>
                <button
                  type="button"
                  className={`${SECONDARY_BUTTON_CLASS} mt-2`}
                  onClick={() => void loadMonth()}
                >
                  {t("retryLoad")}
                </button>
              </div>
            ) : null}
            {!calendarLoadError ? (
              <>
            <div className={`grid grid-cols-7 gap-1 text-center text-[11px] ${TEXT_MUTED_CLASS}`}>
              {CAL_WEEKDAY_KEYS.map((key) => (
                <div key={key}>{ts(`weekday_${key}`)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                if (!cell.ymd) return <div key={`pad-${idx}`} />;
                const row = byYmd.get(cell.ymd);
                const kind = row?.kind ?? "working";
                const bg =
                  kind === "closed"
                    ? "bg-[#EBEDF0]"
                    : kind === "short"
                      ? "bg-[#FEF9E7]"
                      : "bg-[#E8F8F5]";
                const selected = selectedYmd === cell.ymd;
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    className={`min-h-[3.5rem] rounded border border-[#D5DADF] p-1.5 text-left text-[11px] ${bg} ${
                      selected ? "ring-2 ring-[#2980B9]" : "hover:border-[#2980B9]/60"
                    }`}
                    onClick={() => selectDay(cell.ymd!)}
                  >
                    <div className="font-semibold text-[#2C3E50]">{cell.ymd.slice(8)}</div>
                    <div className={TEXT_MUTED_CLASS}>
                      {kind === "closed"
                        ? t("kindClosed")
                        : `${row?.startHour ?? "—"}–${row?.endHour ?? "—"}`}
                    </div>
                    {row?.overridden ? (
                      <div className="text-[10px] text-[#2980B9]">{t("overridden")}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedYmd ? (
              <div className="flex flex-wrap items-end gap-3 border-t border-[#D5DADF] pt-3">
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("dayKind")}
                  value={dayKind}
                  onChange={(v) =>
                    setDayKind(String(Array.isArray(v) ? v[0] : v) as typeof dayKind)
                  }
                  options={[
                    { value: "WORKING", label: t("kindWorking") },
                    { value: "SHORT", label: t("kindShort") },
                    { value: "CLOSED", label: t("kindClosed") },
                  ]}
                />
                {dayKind !== "CLOSED" ? (
                  <>
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={ts("dayStartHour")}
                      value={dayStart}
                      onChange={(v) => setDayStart(String(Array.isArray(v) ? v[0] ?? "" : v))}
                      options={hourOptions(0, 23)}
                    />
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={ts("dayEndHour")}
                      value={dayEnd}
                      onChange={(v) => setDayEnd(String(Array.isArray(v) ? v[0] ?? "" : v))}
                      options={hourOptions(1, 24)}
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void saveDay()}
                >
                  {ts("clinicDaySave")}
                </button>
              </div>
            ) : null}
            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("calendarHint")}</p>
              </>
            ) : null}
          </div>
          <ClinicDayPanel />
        </section>
      ) : null}

      {chip === "peaks" ? (
        <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-[#2C3E50]">{t("chipPeaks")}</h2>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={Boolean(peaksLoadError)}
              onClick={() => {
                setPeakDraft({
                  fromYmd: "",
                  toYmd: "",
                  dayKind: "WORKING",
                  scope: "OWN_ONLY",
                  startHour: "",
                  endHour: "",
                });
                setPeakOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("peakAdd")}
            </button>
          </div>
          {peaksLoadError ? (
            <div
              role="alert"
              className="rounded border border-[#E74C3C]/40 bg-[#FDEDEC] px-3 py-2 text-[13px] text-[#922B21]"
            >
              <p>{t("peaksLoadError")}</p>
              <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>{peaksLoadError}</p>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} mt-2`}
                onClick={() => void loadPeaks()}
              >
                {t("retryLoad")}
              </button>
            </div>
          ) : null}
          {!peaksLoadError ? (
            <>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("peakHint")}</p>
          <p className="text-[13px]">
            <Link href="/admin/master-data?tab=procedureTypes" className={LINK_ACCENT_CLASS}>
              {t("ownProceduresLink")}
            </Link>
          </p>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("peakFrom")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("peakTo")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("dayKind")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("peakScope")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("peakHours")}</th>
                  <th className={`${DATA_TABLE_TH_LEFT_CLASS} text-right`}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {peaks.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={6}>
                      {t("peakEmpty")}
                    </td>
                  </tr>
                ) : (
                  peaks.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.fromYmd}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.toYmd}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.dayKind === "WORKING" ? t("kindWorking") : t("kindShort")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{t(`scope_${row.scope}`)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.scope === "OWN_ONLY"
                          ? "—"
                          : `${row.startHour != null ? formatHour(row.startHour) : "—"}–${
                              row.endHour != null ? formatHour(row.endHour) : "—"
                            }`}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          disabled={busy}
                          onClick={() => void removePeak(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            </>
          ) : null}
        </section>
      ) : null}

      <ModalShell
        open={editSchedule && !!draft}
        onClose={() => setEditSchedule(false)}
        title={t("chipSchedule")}
        footer={
          <ModalFooter
            onCancel={() => setEditSchedule(false)}
            onSubmit={() => void saveSchedule()}
            submitLabel={t("saveSchedule")}
            busy={busy}
          />
        }
      >
        {draft ? (
          <div className={FORM_STACK_CLASS}>
            {(
              [
                ["dayStartHour", "dayStartHour"],
                ["dayEndHour", "dayEndHour"],
                ["lunchStartHour", "lunchStartHour"],
                ["lunchEndHour", "lunchEndHour"],
                ["shortenedDayStartHour", "shortenedDayStartHour"],
                ["shortenedDayEndHour", "shortenedDayEndHour"],
              ] as const
            ).map(([key, labelKey]) => (
              <CatalogField
                key={key}
                kind="CLOSED_SMALL"
                label={key.startsWith("shortenedDayStart") ? t(labelKey) : ts(labelKey)}
                value={String(draft[key])}
                onChange={(v) => {
                  const raw = Array.isArray(v) ? v[0] : v;
                  setDraft({ ...draft, [key]: Number(raw) });
                }}
                options={hourOptions(0, 24)}
              />
            ))}
            <div>
              <div className={MODAL_FIELD_LABEL_CLASS}>{ts("closedWeekdays")}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = draft.closedWeekdays.includes(d);
                  return (
                    <label key={d} className="inline-flex items-center gap-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={on}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...draft.closedWeekdays, d]
                            : draft.closedWeekdays.filter((x) => x !== d);
                          setDraft({ ...draft, closedWeekdays: next.sort((a, b) => a - b) });
                        }}
                      />
                      {ts(`weekday_${WEEKDAY_KEYS[d]}`)}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={draft.peakModeEnabled}
                onChange={(e) => setDraft({ ...draft, peakModeEnabled: e.target.checked })}
              />
              {t("legacyPeakCards")}
            </label>
            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("legacyPeakHint")}</p>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={peakOpen}
        onClose={() => setPeakOpen(false)}
        title={t("peakAdd")}
        footer={
          <ModalFooter
            onCancel={() => setPeakOpen(false)}
            onSubmit={() => void savePeak()}
            submitLabel={t("peakSave")}
            busy={busy}
            submitDisabled={!peakDraft.fromYmd}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <DatePicker
            label={t("peakFrom")}
            placeholder={tc("datePlaceholder")}
            value={peakDraft.fromYmd}
            onChange={(v) => setPeakDraft({ ...peakDraft, fromYmd: v })}
          />
          <DatePicker
            label={t("peakTo")}
            placeholder={tc("datePlaceholder")}
            value={peakDraft.toYmd}
            onChange={(v) => setPeakDraft({ ...peakDraft, toYmd: v })}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("dayKind")}
            value={peakDraft.dayKind}
            onChange={(v) =>
              setPeakDraft({
                ...peakDraft,
                dayKind: String(Array.isArray(v) ? v[0] : v) as PeakDraft["dayKind"],
              })
            }
            options={[
              { value: "WORKING", label: t("kindWorking") },
              { value: "SHORT", label: t("kindShort") },
            ]}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("peakScope")}
            value={peakDraft.scope}
            onChange={(v) =>
              setPeakDraft({
                ...peakDraft,
                scope: String(Array.isArray(v) ? v[0] : v) as PeakDraft["scope"],
              })
            }
            options={[
              { value: "OWN_ONLY", label: t("scope_OWN_ONLY") },
              { value: "EMPTY_DEFAULT", label: t("scope_EMPTY_DEFAULT") },
              { value: "CLINIC_WIDE", label: t("scope_CLINIC_WIDE") },
            ]}
          />
          {peakDraft.scope !== "OWN_ONLY" ? (
            <>
              <CatalogField
                kind="CLOSED_SMALL"
                label={ts("dayStartHour")}
                value={peakDraft.startHour}
                onChange={(v) =>
                  setPeakDraft({
                    ...peakDraft,
                    startHour: String(Array.isArray(v) ? v[0] ?? "" : v),
                  })
                }
                options={[{ value: "", label: "—" }, ...hourOptions(0, 23)]}
              />
              <CatalogField
                kind="CLOSED_SMALL"
                label={ts("dayEndHour")}
                value={peakDraft.endHour}
                onChange={(v) =>
                  setPeakDraft({
                    ...peakDraft,
                    endHour: String(Array.isArray(v) ? v[0] ?? "" : v),
                  })
                }
                options={[{ value: "", label: "—" }, ...hourOptions(1, 24)]}
              />
            </>
          ) : null}
        </div>
      </ModalShell>
    </div>
  );
}
