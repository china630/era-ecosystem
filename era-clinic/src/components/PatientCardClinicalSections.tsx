"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, LayoutGrid, Printer, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  Field,
  FieldSelect,
  LINK_ACCENT_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  showSuccess,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import type { L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { bakuDateKey, bakuDateTimeLabel, addBakuDays, bakuDayBounds, bakuTimeLabel, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";
import { localizeSlotDecision } from "@/lib/slot-decision-ui";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";
import type { PhysioChipsValue } from "@/components/physio/PhysioSiteChips";
import {
  EpisodeAssignBlocks,
} from "@/components/sanatorium/EpisodeAssignChrome";
import { PackageAssignModal } from "@/components/sanatorium/PackageAssignModal";
import { packageAssignBlockText } from "@/lib/package-assign-block";
import {
  formatPackageAssignMissLines,
  toastPackageAssignOutcome,
} from "@/lib/package-assign-toasts";
type TimelineEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  titleL10n?: L10n;
  subtitle?: string;
  status: string;
  href?: string;
  hasCritical?: boolean;
  resultSummary?: Array<{ code: string; value: string; flag?: string }>;
  physio?: PhysioChipsValue & { bodyPart?: string | null };
};

type TimelineDay = {
  date: string;
  labelHint: string;
  events: TimelineEvent[];
};

type IntakeChecklistItem = {
  slot: string;
  resolvedCode: string;
  kind: string;
  title: L10n;
  status: "DONE" | "ORDERED" | "MISSING";
  href: string | null;
  recordId: string | null;
  scheduledAt?: string | null;
};

type CardSummary = {
  limits: {
    resultsPreview: number;
    planPreview: number;
    historyPageSize: number;
    planPageSize: number;
  };
  nowNext: {
    nextAppointment: {
      id: string;
      at: string;
      atLabel?: string;
      status: string;
      practitionerName: string;
      roomCode: string | null;
      href: string;
    } | null;
    activeEpisode: {
      id: string;
      status: string;
      programCode: string | null;
      roomNumber: string | null;
      openedAt: string;
      href: string;
    } | null;
    nextProcedure: {
      id: string;
      at: string;
      atLabel?: string;
      name: string;
      code: string;
      status: string;
    } | null;
    pendingLabs: { count: number; items: TimelineEvent[] };
  };
  resultsPreview: TimelineEvent[];
  planPreview: TimelineEvent[];
  proposedPreview?: TimelineEvent[];
  pendingExtras?: Array<{
    id: string;
    title: string;
    code: string;
    amountNet: number;
    status: string;
  }>;
  intakeChecklist?: {
    packageCode: string;
    packageTitle: L10n | null;
    items: IntakeChecklistItem[];
  };
  examNotesPreview?: Array<{
    id: string;
    visitId: string;
    at: string;
    atLabel?: string;
    title: string;
    titleL10n?: L10n;
    templateId: string | null;
    doctorName: string;
    href: string;
    printHref: string;
  }>;
};

function eventTitle(ev: TimelineEvent, locale: string): string {
  if (ev.titleL10n) return pickL10n(ev.titleL10n, locale);
  return ev.title;
}

function formatDay(date: string, locale: string, todayWord: string, isToday: boolean): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
  return isToday ? `${todayWord} · ${formatted}` : formatted;
}

function typeDot(type: string): string {
  if (type === "lab_order") return "bg-violet-500";
  if (type === "visit") return "bg-sky-500";
  if (type === "procedure") return "bg-emerald-500";
  if (type === "appointment") return "bg-amber-500";
  return "bg-slate-400";
}

type Props = {
  patientRefId: string;
  panel?: string | null;
  episodeId?: string | null;
  /** CLI-57: walk-in hides package assign. */
  patientOrigin?: string | null;
  /** When false, confirm procedures buttons are disabled (ANAMNESIS_REQUIRED). */
  anamnesisOk?: boolean;
  /** Package procedures and schedule. Anamnesis + complaint + ICD-10. Intake shows with the doctor. */
  studiesUnlocked?: boolean;
  readOnly?: boolean;
  /** Bump to reload card-summary (intake checklist after anamnesis/complaint). */
  refreshKey?: number;
  /** Card tab: only that slice. Omit for the legacy stacked card. */
  section?: "diagnostics" | "plan" | "package";
};

export function PatientCardClinicalSections({
  patientRefId,
  panel,
  episodeId,
  patientOrigin,
  anamnesisOk = true,
  studiesUnlocked = false,
  readOnly = false,
  refreshKey = 0,
  section,
}: Props) {
  const t = useTranslations("patientCard");
  const ts = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dayLocale = locale.startsWith("az") ? "az-AZ" : locale.startsWith("ru") ? "ru-RU" : "en-GB";

  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(panel === "history");
  const [printHref, setPrintHref] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const [histTypes, setHistTypes] = useState("all");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [histDays, setHistDays] = useState<TimelineDay[]>([]);
  const [histOffset, setHistOffset] = useState(0);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  const [planDays, setPlanDays] = useState<TimelineDay[]>([]);
  const [planOffset, setPlanOffset] = useState(0);
  const [planHasMore, setPlanHasMore] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [planDate, setPlanDate] = useState(todayBakuYmd());
  const [planBusy, setPlanBusy] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayBakuYmd());
  const [rescheduleTime, setRescheduleTime] = useState("10:00");
  const [cancelAskId, setCancelAskId] = useState<string | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [quotaRows, setQuotaRows] = useState<
    Array<{
      procedureCode: string;
      procedureName: string;
      quotaTotal: number;
      quotaUsed: number;
      consumed: number;
      assignable: boolean;
    }>
  >([]);
  const [packageBlock, setPackageBlock] = useState<string | null>(null);
  const [packageCode, setPackageCode] = useState<string | null>(null);
  const [quotaTick, setQuotaTick] = useState(0);
  const [visitSlot, setVisitSlot] = useState<{ id: string; title: string } | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("09:00");
  const [visitBusy, setVisitBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (episodeId) params.set("episode", episodeId);
    params.set("locale", locale);
    const q = `?${params.toString()}`;
    const res = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
    const data = await res.json();
    const row = (data.data ?? data) as CardSummary;
    setSummary(row);
    setLoading(false);
  }, [patientRefId, episodeId, locale, refreshKey]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (panel === "history") setHistoryOpen(true);
  }, [panel]);

  useEffect(() => {
    if (section !== "package" || !episodeId) {
      setQuotaRows([]);
      setPackageBlock(null);
      setPackageCode(null);
      return;
    }
    void fetch(`/api/sanatorium/episodes/${episodeId}/package-assign`)
      .then((res) => res.json())
      .then((payload) => {
        const snap = payload.data ?? payload;
        const rows = Array.isArray(snap.balances) ? snap.balances : [];
        setQuotaRows(
          rows.map((row: {
            procedureCode: string;
            procedureName: string;
            quotaTotal: number;
            quotaUsed: number;
            consumed: number;
            assignable: boolean;
          }) => ({
            procedureCode: row.procedureCode,
            procedureName: row.procedureName,
            quotaTotal: row.quotaTotal,
            quotaUsed: row.quotaUsed,
            consumed: row.consumed,
            assignable: row.assignable !== false,
          })),
        );
        setPackageBlock(typeof snap.blockReason === "string" ? snap.blockReason : null);
        setPackageCode(typeof snap.packageCode === "string" ? snap.packageCode : null);
      })
      .catch(() => {
        setQuotaRows([]);
        setPackageBlock(null);
        setPackageCode(null);
      });
  }, [section, episodeId, refreshKey, packageModalOpen, quotaTick]);

  const fromIso = useMemo(() => {
    if (period === "all") return undefined;
    return bakuDayBounds(addBakuDays(todayBakuYmd(), -Number(period))).start.toISOString();
  }, [period]);

  const loadHistory = useCallback(
    async (reset: boolean) => {
      setHistLoading(true);
      const offset = reset ? 0 : histOffset;
      const params = new URLSearchParams({
        section: "history",
        types: histTypes,
        offset: String(offset),
      });
      if (fromIso) params.set("from", fromIso);
      if (episodeId) params.set("episode", episodeId);
      params.set("locale", locale);
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setHistDays((prev) => (reset ? days : mergeDays(prev, days)));
      setHistOffset(row.nextOffset ?? offset);
      setHistHasMore(Boolean(row.hasMore));
      setHistLoading(false);
    },
    [patientRefId, episodeId, histTypes, fromIso, histOffset, locale],
  );

  const loadPlan = useCallback(
    async (reset: boolean) => {
      setPlanLoading(true);
      const offset = reset ? 0 : planOffset;
      const params = new URLSearchParams({
        section: "plan",
        offset: String(offset),
      });
      if (episodeId) params.set("episode", episodeId);
      params.set("locale", locale);
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setPlanDays((prev) => (reset ? days : mergeDays(prev, days, "asc")));
      setPlanOffset(row.nextOffset ?? offset);
      setPlanHasMore(Boolean(row.hasMore));
      setPlanLoading(false);
    },
    [patientRefId, episodeId, planOffset, locale],
  );

  useEffect(() => {
    if (historyOpen) void loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset feed when filters/episode change
  }, [historyOpen, histTypes, period, episodeId]);

  useEffect(() => {
    if (section === "plan") void loadPlan(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, episodeId]);

  const planChipDates = useMemo(() => {
    const dates = new Set(planDays.map((day) => day.date));
    dates.add(todayBakuYmd());
    return [...dates].sort();
  }, [planDays]);

  const planVisible = useMemo(
    () =>
      planDays
        .filter((day) => planDate === "all" || day.date === planDate)
        .flatMap((day) => day.events),
    [planDays, planDate],
  );

  if (loading || !summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  function openPrint(href: string) {
    setPrintHref(href);
    setPrintOpen(true);
  }

  async function cancelPlanOrder(orderId: string) {
    setCancelAskId(null);
    setPlanBusy(true);
    try {
      const res = await fetch(`/api/procedures/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "reception_episode_chart" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      await loadPlan(true);
    } finally {
      setPlanBusy(false);
    }
  }

  function planStatusLabel(status: string): string {
    const key =
      status === "SCHEDULED"
        ? "statusScheduled"
        : status === "CHECKED_IN" || status === "IN_PROGRESS"
          ? "statusCheckedIn"
          : status === "NO_SHOW"
            ? "statusNoShow"
            : status === "COMPLETED"
              ? "statusCompleted"
              : status === "CANCELLED"
                ? "statusCancelled"
                : status === "PROPOSED"
                  ? "statusProposed"
                  : "";
    return key ? ts(key) : status;
  }

  function planChipLabel(ymd: string): string {
    const [year, month, day] = ymd.split("-");
    if (!year || !month || !day) return ymd;
    return `${day}.${month}.${year}`;
  }

  async function submitPlanReschedule() {
    if (!rescheduleId) return;
    const day = rescheduleDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(rescheduleTime)) {
      showApiError({ error: tc("failed") }, tc("failed"));
      return;
    }
    const scheduledAtDate = parseBakuDateTime(day, `${rescheduleTime}:00`);
    if (scheduledAtDate.getTime() < Date.now()) {
      showApiError({ error: ts("reschedulePast") }, tc("failed"));
      return;
    }
    setPlanBusy(true);
    try {
      const scheduledAt = scheduledAtDate.toISOString();
      const res = await fetch(`/api/procedures/${rescheduleId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, allowOtherDay: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(localizeSlotDecision(data, ts), tc("failed"));
        return;
      }
      setRescheduleId(null);
      await loadPlan(true);
    } finally {
      setPlanBusy(false);
    }
  }

  function labPrintHref(ev: TimelineEvent): string | null {
    const m = (ev.href || "").match(/lab-orders\/([^/?#]+)/);
    if (!m) return null;
    const id = m[1];
    const title = (ev.titleL10n ? pickL10n(ev.titleL10n, "en") : ev.title).toLowerCase();
    if (/usg|usm|ultrasound|abdomen/.test(title)) return `/print/usm/${id}`;
    return `/print/lab-order/${id}`;
  }

  const { resultsPreview } = summary;
  const pendingExtras = summary.pendingExtras ?? [];
  const intakeChecklist = summary.intakeChecklist;

  const showDiagnostics = !section || section === "diagnostics";
  const showPackage = !section || section === "package";
  const showInlinePlan = section === "plan";

  return (
    <div className="space-y-6">
      {showDiagnostics && resultsPreview.length > 0 ? (
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("resultsTitle")}
          </h2>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setHistTypes("all");
              setHistoryOpen(true);
            }}
          >
            {t("openHistory")}
          </button>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {resultsPreview.length === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("resultsEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {resultsPreview.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-[13px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div className="min-w-0 flex-1">
                    {ev.href ? (
                      <Link href={ev.href} className={`font-medium ${LINK_ACCENT_CLASS}`}>
                        {eventTitle(ev, locale)}
                      </Link>
                    ) : (
                      <span className="font-medium">{eventTitle(ev, locale)}</span>
                    )}
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {ev.subtitle} · {ev.status}
                      {ev.hasCritical ? (
                        <span className={`ml-2 ${TEXT_DANGER_CLASS}`}>{t("critical")}</span>
                      ) : null}
                    </p>
                    {ev.href && /lab-orders\//.test(ev.href) ? (
                      <a
                        href={`${ev.href.replace(/[?#].*$/, "")}/file`.replace(
                          "/lab-orders/",
                          "/api/lab-orders/",
                        )}
                        className={`mt-1 inline-block ${LINK_ACCENT_CLASS}`}
                      >
                        {t("downloadLabFile", { defaultValue: "Download lab file" })}
                      </a>
                    ) : null}
                  </div>
                  {labPrintHref(ev) ? (
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      aria-label={t("print", { defaultValue: "Print" })}
                      onClick={() => openPrint(labPrintHref(ev)!)}
                    >
                      <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {showDiagnostics && (summary?.examNotesPreview?.length ?? 0) > 0 ? (
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("examNotesTitle", { defaultValue: "Exam notes" })}
          </h2>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {(summary?.examNotesPreview?.length ?? 0) === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
              {t("examNotesEmpty", { defaultValue: "No exam notes yet." })}
            </p>
          ) : (
            <ul className="space-y-2">
              {(summary?.examNotesPreview ?? []).map((note) => (
                <li key={note.id} className="flex items-start gap-2 text-[13px]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                  <div className="min-w-0 flex-1">
                    <Link href={note.href} className={`font-medium ${LINK_ACCENT_CLASS}`}>
                      {note.titleL10n ? pickL10n(note.titleL10n, locale) : note.title}
                    </Link>
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {note.atLabel ?? note.at}
                      {note.doctorName ? ` · ${note.doctorName}` : ""}
                      {note.templateId ? ` · ${note.templateId}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={t("printExam", { defaultValue: "Print exam" })}
                    onClick={() => openPrint(note.printHref)}
                  >
                    <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {showDiagnostics && !intakeChecklist?.items?.length && resultsPreview.length === 0 ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
          {t("intakeChecklistEmpty", { defaultValue: "No intake diagnostics on this course." })}
        </p>
      ) : null}

      {showDiagnostics && intakeChecklist?.items?.length ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {t("intakeChecklistTitle", {
                defaultValue: intakeChecklist.packageTitle
                  ? pickL10n(intakeChecklist.packageTitle, locale)
                  : "Initial diagnostics",
              })}
            </h2>
          </div>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <ul className="divide-y divide-slate-100">
              {intakeChecklist.items.map((item) => {
                const statusLabel =
                  item.status === "DONE"
                    ? t("intakeStatusDone", { defaultValue: "Done" })
                    : item.status === "ORDERED"
                      ? t("intakeStatusOrdered", { defaultValue: "Ordered" })
                      : t("intakeStatusMissing", { defaultValue: "Missing" });
                const statusClass =
                  item.status === "DONE"
                    ? "text-emerald-700"
                    : item.status === "ORDERED"
                      ? "text-amber-700"
                      : TEXT_MUTED_CLASS;
                return (
                  <li
                    key={item.slot}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px] first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      {item.href ? (
                        <Link href={item.href} className={`font-medium ${LINK_ACCENT_CLASS}`}>
                          {pickL10n(item.title, locale)}
                        </Link>
                      ) : (
                        <span className="font-medium">{pickL10n(item.title, locale)}</span>
                      )}
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{item.resolvedCode}</p>
                    </div>
                    {item.kind === "visit" && item.recordId ? (
                      <button
                        type="button"
                        className={
                          item.scheduledAt
                            ? `shrink-0 text-[12px] font-medium ${LINK_ACCENT_CLASS}`
                            : SECONDARY_BUTTON_CLASS
                        }
                        onClick={() => {
                          setVisitSlot({
                            id: item.recordId!,
                            title: pickL10n(item.title, locale),
                          });
                          setVisitDate(
                            item.scheduledAt ? bakuDateKey(item.scheduledAt) : todayBakuYmd(),
                          );
                          setVisitTime("09:00");
                          setVisitBusy(false);
                        }}
                      >
                        {item.scheduledAt
                          ? bakuDateTimeLabel(item.scheduledAt)
                          : t("intakeAssignTime", { defaultValue: "Assign time" })}
                      </button>
                    ) : (
                      <span className={`shrink-0 text-[12px] font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {showPackage && studiesUnlocked ? (
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("assignSectionTitle", { defaultValue: "Procedure assign" })}
        </h2>
        {episodeId ? (
          <EpisodeAssignBlocks
            packageTitle={t("assignPackageTitle", { defaultValue: "Procedures in package" })}
            extrasTitle={t("extrasAwaiting", { defaultValue: "Additional procedures (awaiting payment)" })}
            readOnly={readOnly || !anamnesisOk}
            hidePackage={patientOrigin === "WALK_IN"}
            extrasPending={pendingExtras.map((row) => ({
              id: row.id,
              title: row.title,
              amountNet: row.amountNet,
              status: row.status,
            }))}
            pendingPayLabel={t("pendingPay", { defaultValue: "Awaiting payment" })}
            onPackagePlus={() => setPackageModalOpen(true)}
            onExtrasPlus={() => setPackageModalOpen(true)}
          />
        ) : (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
            {t("assignNeedsEpisode", {
              defaultValue: "Open a sanatorium course to assign package procedures.",
            })}
          </p>
        )}
      </section>
      ) : null}

      {showPackage && packageBlock ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
          {packageAssignBlockText(t, packageBlock) ?? packageBlock}
        </p>
      ) : null}

      {showPackage && (packageBlock === "NO_PROGRAM" || packageBlock === "NO_PROGRAM_CODE") && episodeId ? (
        <div className="flex flex-wrap gap-2">
          {packageCode ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                void fetch(`/api/sanatorium/episodes/${episodeId}?action=complete-checkup`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ programCode: packageCode }),
                }).then(async (res) => {
                  if (!res.ok) {
                    showApiError(await res.json().catch(() => ({})), tc("failed"));
                    return;
                  }
                  setQuotaTick((n) => n + 1);
                  void loadSummary();
                });
              }}
            >
              {ts("completeCheckupSchedule")}
            </button>
          ) : null}
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              void fetch(`/api/sanatorium/episodes/${episodeId}/confirm-no-package`, {
                method: "POST",
              }).then(async (res) => {
                if (!res.ok) {
                  showApiError(await res.json().catch(() => ({})), tc("failed"));
                  return;
                }
                setQuotaTick((n) => n + 1);
                void loadSummary();
              });
            }}
          >
            {ts("confirmNoPackage")}
          </button>
        </div>
      ) : null}

      {showPackage && quotaRows.length > 0 ? (
        <section className="space-y-2">
          <ul className="space-y-3">
            {quotaRows.map((line) => {
              const assignedPct =
                line.quotaTotal > 0
                  ? Math.min(100, (line.quotaUsed / line.quotaTotal) * 100)
                  : 0;
              const donePct =
                line.quotaUsed > 0
                  ? Math.min(100, (line.consumed / line.quotaUsed) * 100)
                  : 0;
              return (
                <li key={line.procedureCode} className={`${CARD_CONTAINER_CLASS} p-3 text-[13px]`}>
                  <div className="mb-1 font-medium">{line.procedureName || line.procedureCode}</div>
                  <div className="mb-0.5 flex justify-between text-[12px]">
                    <span>{ts("quotaAssigned")}</span>
                    <span>
                      {ts("quotaUsed", { used: line.quotaUsed, total: line.quotaTotal })}
                    </span>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-lg bg-slate-100">
                    <div className="h-full bg-[#2980B9]" style={{ width: `${assignedPct}%` }} />
                  </div>
                  <div className="mb-0.5 flex justify-between text-[12px]">
                    <span>{ts("quotaCompleted")}</span>
                    <span>
                      {ts("quotaUsed", { used: line.consumed, total: line.quotaUsed })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-lg bg-slate-100">
                    <div className="h-full bg-emerald-600" style={{ width: `${donePct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {showInlinePlan ? (
        <section className="flex min-h-0 flex-1 flex-col space-y-3">
          {studiesUnlocked && episodeId ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={t("printProcedures", { defaultValue: "Print schedule" })}
                onClick={() =>
                  openPrint(
                    `/print/procedures/${patientRefId}?episode=${encodeURIComponent(episodeId)}`,
                  )
                }
              >
                <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={readOnly || !anamnesisOk}
                onClick={() => setPackageModalOpen(true)}
              >
                +
              </button>
            </div>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className={planDate === "all" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              onClick={() => setPlanDate("all")}
            >
              {t("planAll")}
            </button>
            {planChipDates.map((date) => (
              <button
                key={date}
                type="button"
                className={planDate === date ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
                onClick={() => setPlanDate(date)}
              >
                {date === todayBakuYmd() ? t("today") : planChipLabel(date)}
              </button>
            ))}
          </div>
          {planVisible.length === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
              {planLoading ? tc("loading") : t("planEmpty")}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {planVisible.map((ev) => {
                const orderId = ev.id.startsWith("procedure:") ? ev.id.slice("procedure:".length) : "";
                const scheduled = ev.type === "procedure" && ev.status === "SCHEDULED" && orderId;
                const proposed = ev.type === "procedure" && ev.status === "PROPOSED" && orderId;
                const actionable = scheduled || proposed;
                return (
                  <li
                    key={ev.id}
                    className={`${CARD_CONTAINER_CLASS} flex items-start justify-between gap-2 px-3 py-2 text-[13px]`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{eventTitle(ev, locale)}</div>
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {ev.at ? bakuDateTimeLabel(ev.at) : ""}
                        {ev.status ? ` · ${planStatusLabel(ev.status)}` : ""}
                      </p>
                    </div>
                    {actionable ? (
                      <div className="flex shrink-0 gap-1">
                        {scheduled ? (
                          <>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={ts("reschedule")}
                              disabled={planBusy}
                              onClick={() => {
                                setRescheduleId(orderId);
                                setRescheduleDate(ev.at ? bakuDateKey(ev.at) : todayBakuYmd());
                                setRescheduleTime(ev.at ? bakuTimeLabel(ev.at) : "10:00");
                              }}
                            >
                              <CalendarClock className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                            </button>
                            <Link
                              href={`/sanatorium/resources?date=${encodeURIComponent(ev.at ? bakuDateKey(ev.at) : todayBakuYmd())}&highlight=${encodeURIComponent(orderId)}`}
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={ts("openMatrix")}
                            >
                              <LayoutGrid className="h-4 w-4 text-[#2980B9]" aria-hidden />
                            </Link>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={ts("cancelProcedure")}
                          disabled={planBusy}
                          onClick={() => setCancelAskId(orderId)}
                        >
                          <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {studiesUnlocked && episodeId ? (
        <>
          <PackageAssignModal
            open={packageModalOpen}
            episodeId={episodeId}
            onClose={() => setPackageModalOpen(false)}
            onSaved={async () => {
              const q = `?${new URLSearchParams({
                episode: episodeId,
                locale,
              }).toString()}`;
              const r = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
              if (r.ok) {
                const d = await r.json();
                setSummary(d.data ?? d);
              }
              await loadPlan(true);
              setQuotaTick((n) => n + 1);
            }}
            labels={{
              title: t("assignPackageTitle", { defaultValue: "Procedures in package" }),
              save: tc("save"),
              cancel: tc("cancel"),
              leftMenu: t("packageMenuLeft", { defaultValue: "Package remaining" }),
              rightAssigned: t("packageMenuRight", { defaultValue: "Assigned" }),
              remaining: t("remaining", { defaultValue: "Remaining" }),
              qty: t("qty", { defaultValue: "Quantity" }),
              note: t("note", { defaultValue: "Note" }),
              addToDraft: t("addToDraft", { defaultValue: "Add" }),
              all: t("assignAll", { defaultValue: "All" }),
              delete: tc("delete"),
              consumedLocked: t("consumedLocked", { defaultValue: "Completed" }),
              emptyLeft: t("packageEmptyLeft", { defaultValue: "No package lines." }),
              emptyRight: t("packageEmptyRight", { defaultValue: "Nothing assigned yet." }),
              softWarnPrefix: t("softWarn", { defaultValue: "Note" }),
              replace: t("replaceProcedure", { defaultValue: "Replace" }),
              replaceFrom: t("replaceFrom", { defaultValue: "From" }),
              replaceTo: t("replaceTo", { defaultValue: "To" }),
              replaceSubmit: t("replaceSubmit", { defaultValue: "Replace" }),
              qtyDown: t("qtyDown", { defaultValue: "−1" }),
              checkedInLocked: t("checkedInLocked", { defaultValue: "Checked in" }),
              pickPoolSku: t("pickProcedure", { defaultValue: "Procedure" }),
            }}
          />
        </>
      ) : null}

      <ModalShell
        open={historyOpen}
        title={t("historyModalTitle")}
        onClose={() => setHistoryOpen(false)}
        closeLabel={tc("close")}
      >
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <FieldSelect
            label={t("filterHistoryType")}
            preset="select"
            value={histTypes}
            onChange={(e) => setHistTypes(e.target.value)}
          >
            <option value="all">{t("filterHistoryAll")}</option>
            <option value="appointment">{t("filterAppointment")}</option>
            <option value="visit">{t("filterVisit")}</option>
            <option value="lab_imaging">{t("filterExam")}</option>
            <option value="lab_panel">{t("filterLab")}</option>
          </FieldSelect>
          <FieldSelect
            label={t("filterPeriod")}
            preset="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as "7" | "30" | "90" | "all")}
          >
            <option value="7">{t("period7")}</option>
            <option value="30">{t("period30")}</option>
            <option value="90">{t("period90")}</option>
            <option value="all">{t("periodAll")}</option>
          </FieldSelect>
        </div>
        <HistoryCards
          days={histDays}
          locale={dayLocale}
          uiLocale={locale}
          todayWord={t("today")}
          empty={t("historyEmpty")}
          loading={histLoading}
          loadingLabel={tc("loading")}
          printLabel={t("print", { defaultValue: "Print" })}
          labPrintHref={labPrintHref}
          onPrint={openPrint}
        />
        {histHasMore ? (
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-3`}
            disabled={histLoading}
            onClick={() => void loadHistory(false)}
          >
            {t("loadMore")}
          </button>
        ) : null}
        <p className={`mt-2 text-[11px] ${TEXT_MUTED_CLASS}`}>{t("tzHint")}</p>
      </ModalShell>

      <ModalShell
        open={Boolean(rescheduleId)}
        title={ts("reschedule")}
        onClose={() => setRescheduleId(null)}
        footer={
          <ModalFooter
            onCancel={() => setRescheduleId(null)}
            onSubmit={() => void submitPlanReschedule()}
            busy={planBusy}
            submitLabel={tc("save")}
          />
        }
      >
        <div className="grid grid-cols-1 items-end gap-2">
          <p className={`m-0 text-[12px] ${TEXT_MUTED_CLASS}`}>{ts("rescheduleSameDayHint")}</p>
          <DatePicker
            label={tc("date")}
            value={rescheduleDate}
            onChange={setRescheduleDate}
            placeholder="dd.mm.yyyy"
          />
          <CatalogField
            kind="SEARCHABLE"
            label={ts("procedureTime")}
            value={rescheduleTime}
            emptyLabel={null}
            options={Array.from({ length: ((21 - 8) * 60) / 5 }, (_, index) => {
              const total = 8 * 60 + index * 5;
              const hh = String(Math.floor(total / 60)).padStart(2, "0");
              const mm = String(total % 60).padStart(2, "0");
              const label = `${hh}:${mm}`;
              return { value: label, label };
            })}
            onChange={(value) => setRescheduleTime(String(value ?? "09:00"))}
          />
        </div>
      </ModalShell>
      <ModalShell
        open={Boolean(cancelAskId)}
        title={ts("confirmCancelProcedure")}
        onClose={() => setCancelAskId(null)}
        footer={
          <ModalFooter
            onCancel={() => setCancelAskId(null)}
            onSubmit={() => {
              if (cancelAskId) void cancelPlanOrder(cancelAskId);
            }}
            busy={planBusy}
            submitLabel={ts("cancelProcedure")}
          />
        }
      >
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{ts("confirmCancelProcedure")}</p>
      </ModalShell>
      <ModalShell
        open={Boolean(visitSlot)}
        title={t("intakeAssignTime", { defaultValue: "Assign time" })}
        subtitle={visitSlot?.title}
        onClose={() => {
          if (!visitBusy) setVisitSlot(null);
        }}
        closeLabel={tc("close")}
      >
        <div className="space-y-3">
          <DatePicker
            label={tc("date")}
            value={visitDate}
            onChange={setVisitDate}
            placeholder="dd.mm.yyyy"
          />
          <Field
            label={t("intakeVisitTime", { defaultValue: "Time" })}
            preset="shortText"
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
          />
        </div>
        <ModalFooter
          onCancel={() => setVisitSlot(null)}
          busy={visitBusy}
          submitDisabled={!visitDate || !/^\d{2}:\d{2}$/.test(visitTime)}
          submitLabel={tc("save")}
          cancelLabel={tc("cancel")}
          onSubmit={() => {
            if (!visitSlot) return;
            setVisitBusy(true);
            void fetch(`/api/visits/${visitSlot.id}/appointment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: visitDate, time: visitTime }),
            })
              .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  if (data?.code === "CLOSED_DAY") {
                    showApiError({ error: t("intakeClosedDay") }, t("intakeClosedDay"));
                    return;
                  }
                  showApiError(data, tc("failed"));
                  return;
                }
                setVisitSlot(null);
                await loadSummary();
              })
              .finally(() => setVisitBusy(false));
          }}
        />
      </ModalShell>
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
      />
    </div>
  );
}

function mergeDays(
  prev: TimelineDay[],
  next: TimelineDay[],
  dateOrder: "asc" | "desc" = "desc",
): TimelineDay[] {
  const map = new Map<string, TimelineDay>();
  for (const d of prev) map.set(d.date, { ...d, events: [...d.events] });
  for (const d of next) {
    const existing = map.get(d.date);
    if (!existing) {
      map.set(d.date, d);
      continue;
    }
    const ids = new Set(existing.events.map((e) => e.id));
    for (const ev of d.events) {
      if (!ids.has(ev.id)) existing.events.push(ev);
    }
  }
  const days = [...map.values()].map((day) => ({
    ...day,
    events: [...day.events].sort(
      (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
    ),
  }));
  return days.sort((a, b) =>
    dateOrder === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
  );
}

function HistoryCards({
  days,
  locale,
  uiLocale,
  todayWord,
  empty,
  loading,
  loadingLabel,
  printLabel,
  labPrintHref,
  onPrint,
}: {
  days: TimelineDay[];
  locale: string;
  uiLocale: string;
  todayWord: string;
  empty: string;
  loading: boolean;
  loadingLabel: string;
  printLabel: string;
  labPrintHref: (ev: TimelineEvent) => string | null;
  onPrint: (href: string) => void;
}) {
  if (loading && days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{loadingLabel}</p>;
  }
  if (days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{empty}</p>;
  }
  return (
    <ol className="max-h-[60vh] space-y-4 overflow-y-auto">
      {days.map((day) => (
        <li key={day.date}>
          <h3 className="mb-2 text-[13px] font-semibold">
            {formatDay(day.date, locale, todayWord, day.labelHint === "today")}
          </h3>
          <ul className="space-y-2">
            {day.events.map((ev) => {
              const printHref = labPrintHref(ev);
              return (
                <li
                  key={ev.id}
                  className={`${CARD_CONTAINER_CLASS} flex items-center gap-2 p-3 text-[13px]`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{eventTitle(ev, uiLocale)}</p>
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {bakuDateTimeLabel(ev.at)} · {ev.status}
                    </p>
                  </div>
                  {printHref ? (
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      aria-label={printLabel}
                      onClick={() => onPrint(printHref)}
                    >
                      <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
