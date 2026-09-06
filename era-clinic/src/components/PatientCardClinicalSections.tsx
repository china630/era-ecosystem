"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FieldSelect,
  LINK_ACCENT_CLASS,
  MODAL_CHECKBOX_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import type { L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { bakuDateTimeLabel } from "@/lib/baku-day";
import { PrintLanguageDialog } from "@/components/print/PrintLanguageDialog";
import {
  PhysioSiteChips,
  type PhysioCatalogListItem,
  type PhysioCatalogSite,
  type PhysioChipsLabels,
  type PhysioChipsValue,
} from "@/components/physio/PhysioSiteChips";
import { buildPhysioChipsLabels } from "@/components/physio/physio-chips-labels";
import {
  EpisodeAssignBlocks,
  EpisodeScheduleCards,
} from "@/components/sanatorium/EpisodeAssignChrome";
import { PackageAssignModal } from "@/components/sanatorium/PackageAssignModal";
import { ExtrasAssignModal } from "@/components/sanatorium/ExtrasAssignModal";

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

const EMPTY_PHYSIO: PhysioChipsValue = {
  needsSite: true,
  physioOrderFields: [],
  allowedSiteCodes: [],
  forceSiteTogether: false,
  sitesHintKey: null,
  siteIds: [],
  siteApplyMode: null,
  siteLaterality: {},
  physioFields: {},
  note: null,
};

function orderIdFromEvent(ev: TimelineEvent): string | null {
  if (!ev.id.startsWith("procedure:")) return null;
  return ev.id.slice("procedure:".length) || null;
}

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
  readOnly?: boolean;
  /** Bump to reload card-summary (intake checklist after anamnesis/complaint). */
  refreshKey?: number;
};

export function PatientCardClinicalSections({
  patientRefId,
  panel,
  episodeId,
  patientOrigin,
  anamnesisOk = true,
  readOnly = false,
  refreshKey = 0,
}: Props) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dayLocale = locale.startsWith("az") ? "az-AZ" : locale.startsWith("ru") ? "ru-RU" : "en-GB";

  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(panel === "history");
  const [planOpen, setPlanOpen] = useState(panel === "plan");
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
  const [selectedProposed, setSelectedProposed] = useState<Set<string>>(new Set());
  const [physioCatalog, setPhysioCatalog] = useState<PhysioCatalogSite[]>([]);
  const [physioPrograms, setPhysioPrograms] = useState<PhysioCatalogListItem[]>([]);
  const [physioSubstances, setPhysioSubstances] = useState<PhysioCatalogListItem[]>([]);
  const [physioById, setPhysioById] = useState<Record<string, PhysioChipsValue>>({});
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [day1Busy, setDay1Busy] = useState(false);

  const physioLabels: PhysioChipsLabels = useMemo(
    () => buildPhysioChipsLabels(t),
    [t],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/physio-catalog");
        const data = await res.json();
        const sites = (data.sites ?? data.data?.sites ?? []) as PhysioCatalogSite[];
        const programs = (data.programs ?? data.data?.programs ?? []) as PhysioCatalogListItem[];
        const substances = (data.substances ?? data.data?.substances ?? []) as PhysioCatalogListItem[];
        setPhysioCatalog(Array.isArray(sites) ? sites : []);
        setPhysioPrograms(Array.isArray(programs) ? programs : []);
        setPhysioSubstances(Array.isArray(substances) ? substances : []);
      } catch {
        /* chips stay empty until catalog loads */
      }
    })();
  }, []);

  const mergePhysioFromEvents = useCallback((events: TimelineEvent[]) => {
    setPhysioById((prev) => {
      const next = { ...prev };
      for (const ev of events) {
        const oid = orderIdFromEvent(ev);
        if (!oid || !ev.physio) continue;
        next[oid] = {
          needsSite: ev.physio.needsSite,
          physioOrderFields: ev.physio.physioOrderFields ?? [],
          allowedSiteCodes: ev.physio.allowedSiteCodes ?? [],
          forceSiteTogether: ev.physio.forceSiteTogether === true,
          sitesHintKey: ev.physio.sitesHintKey ?? null,
          siteIds: ev.physio.siteIds,
          siteApplyMode:
            ev.physio.forceSiteTogether === true ? "TOGETHER" : ev.physio.siteApplyMode,
          siteLaterality: ev.physio.siteLaterality ?? {},
          physioFields: ev.physio.physioFields ?? {},
          note: ev.physio.note,
        };
      }
      return next;
    });
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const q = episodeId ? `?episode=${encodeURIComponent(episodeId)}` : "";
    const res = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
    const data = await res.json();
    const row = (data.data ?? data) as CardSummary;
    setSummary(row);
    mergePhysioFromEvents([...(row.proposedPreview ?? []), ...(row.planPreview ?? [])]);
    setLoading(false);
  }, [patientRefId, episodeId, mergePhysioFromEvents, refreshKey]);

  async function patchPhysio(
    orderId: string,
    patch: {
      siteIds?: string[];
      siteApplyMode?: "TOGETHER" | "TURN";
      note?: string | null;
      siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
      physioFields?: PhysioChipsValue["physioFields"];
    },
  ) {
    setPhysioById((prev) => {
      const cur = prev[orderId] ?? EMPTY_PHYSIO;
      return {
        ...prev,
        [orderId]: {
          ...cur,
          ...(patch.siteIds !== undefined ? { siteIds: patch.siteIds } : {}),
          ...(patch.siteApplyMode ? { siteApplyMode: patch.siteApplyMode } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          ...(patch.siteLaterality
            ? { siteLaterality: { ...cur.siteLaterality, ...patch.siteLaterality } }
            : {}),
          ...(patch.physioFields !== undefined ? { physioFields: patch.physioFields } : {}),
        },
      };
    });
    await fetch(`/api/procedures/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function confirmOrders(orderIds: string[]) {
    if (orderIds.length === 0) return;
    setConfirmBusy(true);
    setConfirmMsg(null);
    const res = await fetch("/api/procedures/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    setConfirmBusy(false);
    if (!res.ok) {
      setConfirmMsg(t("confirmFailed", { defaultValue: "Confirm failed" }));
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      softWarn?: string;
    };
    setSelectedProposed(new Set());
    setConfirmMsg(
      data.softWarn
        ? t("day1SoftWarn", {
            defaultValue:
              "Plan confirmed (soft warn: Nafta day-1 default is 2–3 procedures).",
          })
        : t("confirmOk", { defaultValue: "Plan confirmed" }),
    );
    await loadSummary();
    if (planOpen) await loadPlan(true);
  }

  function toggleProposed(orderId: string) {
    setSelectedProposed((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (panel === "history") setHistoryOpen(true);
    if (panel === "plan") setPlanOpen(true);
  }, [panel]);

  const fromIso = useMemo(() => {
    if (period === "all") return undefined;
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    return d.toISOString();
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
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setHistDays((prev) => (reset ? days : mergeDays(prev, days)));
      setHistOffset(row.nextOffset ?? offset);
      setHistHasMore(Boolean(row.hasMore));
      setHistLoading(false);
    },
    [patientRefId, episodeId, histTypes, fromIso, histOffset],
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
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setPlanDays((prev) => (reset ? days : mergeDays(prev, days)));
      mergePhysioFromEvents(days.flatMap((d) => d.events));
      setPlanOffset(row.nextOffset ?? offset);
      setPlanHasMore(Boolean(row.hasMore));
      setPlanLoading(false);
    },
    [patientRefId, episodeId, planOffset, mergePhysioFromEvents],
  );

  useEffect(() => {
    if (historyOpen) void loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset feed when filters/episode change
  }, [historyOpen, histTypes, period, episodeId]);

  useEffect(() => {
    if (planOpen) void loadPlan(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOpen, episodeId]);

  if (loading || !summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  function openPrint(href: string) {
    setPrintHref(href);
    setPrintOpen(true);
  }

  function labPrintHref(ev: TimelineEvent): string | null {
    const m = (ev.href || "").match(/lab-orders\/([^/?#]+)/);
    if (!m) return null;
    const id = m[1];
    const title = (ev.titleL10n ? pickL10n(ev.titleL10n, "en") : ev.title).toLowerCase();
    if (/usg|usm|ultrasound|abdomen/.test(title)) return `/print/usm/${id}`;
    return `/print/lab-order/${id}`;
  }

  const { resultsPreview, planPreview } = summary;
  const proposedPreview = summary.proposedPreview ?? [];
  const intakeChecklist = summary.intakeChecklist;
  const allProposedIds = proposedPreview
    .map(orderIdFromEvent)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="space-y-6">
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

      {intakeChecklist?.items?.length ? (
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
                    <span className={`shrink-0 text-[12px] font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("assignSectionTitle", { defaultValue: "Procedure assign" })}
        </h2>
        {episodeId ? (
          <EpisodeAssignBlocks
            packageTitle={t("assignPackageTitle", { defaultValue: "Procedures in package" })}
            extrasTitle={t("assignExtrasTitle", { defaultValue: "Additional procedures" })}
            day1Label={t("day1AutoAssign", { defaultValue: "Day-1 auto (≤3)" })}
            readOnly={readOnly || !anamnesisOk}
            day1Busy={day1Busy}
            hidePackage={patientOrigin === "WALK_IN"}
            onPackagePlus={() => setPackageModalOpen(true)}
            onExtrasPlus={() => setExtrasModalOpen(true)}
            onDay1={
              patientOrigin === "WALK_IN"
                ? undefined
                : () => {
                    setDay1Busy(true);
                    void fetch(`/api/sanatorium/episodes/${episodeId}/package-assign/day1`, {
                      method: "POST",
                    })
                      .then(async (res) => {
                        if (!res.ok) {
                          const d = await res.json();
                          setConfirmMsg(d.error ?? "Day-1 failed");
                          return;
                        }
                        setConfirmMsg(null);
                        const q = episodeId ? `?episode=${encodeURIComponent(episodeId)}` : "";
                        const r = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
                        if (r.ok) {
                          const d = await r.json();
                          setSummary(d.data ?? d);
                        }
                      })
                      .finally(() => setDay1Busy(false));
                  }
            }
          />
        ) : (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
            {t("assignNeedsEpisode", {
              defaultValue: "Open a sanatorium course to assign package procedures.",
            })}
          </p>
        )}
        {confirmMsg ? <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{confirmMsg}</p> : null}
      </section>

      <section className="space-y-2">
        <EpisodeScheduleCards
          title={t("scheduleCardsTitle", { defaultValue: "Schedule" })}
          emptyLabel={t("scheduleCardsEmpty", { defaultValue: "No scheduled procedures yet." })}
          items={planPreview.map((ev) => ({
            id: ev.id,
            title: eventTitle(ev, locale),
            subtitle: ev.subtitle,
            status: ev.status,
            atLabel: ev.at ? bakuDateTimeLabel(ev.at) : undefined,
          }))}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPlanOpen(true)}>
            {t("openPlan")}
          </button>
          <button
            type="button"
            className={TABLE_ROW_ICON_BTN_CLASS}
            aria-label={t("printProcedures", { defaultValue: "Print schedule" })}
            onClick={() =>
              openPrint(
                `/print/procedures/${patientRefId}${episodeId ? `?episode=${encodeURIComponent(episodeId)}` : ""}`,
              )
            }
          >
            <Printer className="h-4 w-4 text-[#2980B9]" aria-hidden />
          </button>
        </div>
      </section>

      {episodeId ? (
        <>
          <PackageAssignModal
            open={packageModalOpen}
            episodeId={episodeId}
            onClose={() => setPackageModalOpen(false)}
            onSaved={async () => {
              const q = `?episode=${encodeURIComponent(episodeId)}`;
              const r = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
              if (r.ok) {
                const d = await r.json();
                setSummary(d.data ?? d);
              }
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
          <ExtrasAssignModal
            open={extrasModalOpen}
            episodeId={episodeId}
            onClose={() => setExtrasModalOpen(false)}
            onSaved={async () => {
              const q = `?episode=${encodeURIComponent(episodeId)}`;
              const r = await fetch(`/api/patients/${patientRefId}/card-summary${q}`);
              if (r.ok) {
                const d = await r.json();
                setSummary(d.data ?? d);
              }
            }}
            labels={{
              title: t("assignExtrasTitle", { defaultValue: "Additional procedures" }),
              save: tc("save"),
              cancel: tc("cancel"),
              pickProcedure: t("pickProcedure", { defaultValue: "Procedure" }),
              qty: t("qty", { defaultValue: "Quantity" }),
              note: t("note", { defaultValue: "Note" }),
              addToDraft: t("addToDraft", { defaultValue: "Add" }),
              pending: t("pendingPay", { defaultValue: "Awaiting payment" }),
              price: t("price", { defaultValue: "Price" }),
              delete: tc("delete"),
              empty: t("extrasEmpty", { defaultValue: "No additional procedures." }),
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
        open={planOpen}
        title={t("planModalTitle")}
        onClose={() => setPlanOpen(false)}
        closeLabel={tc("close")}
      >
        {episodeId ? (
          <p className="mb-3 text-[13px]">
            <Link
              href={`/sanatorium?episode=${encodeURIComponent(episodeId)}`}
              className={LINK_ACCENT_CLASS}
            >
              {t("openDayPlan")}
            </Link>
          </p>
        ) : null}
        {(() => {
          const modalProposed = planDays
            .flatMap((d) => d.events)
            .filter((ev) => ev.status === "PROPOSED")
            .map(orderIdFromEvent)
            .filter((id): id is string => Boolean(id));
          if (modalProposed.length === 0) return null;
          return (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={
                  confirmBusy ||
                  selectedProposed.size === 0 ||
                  !anamnesisOk ||
                  readOnly
                }
                onClick={() => void confirmOrders([...selectedProposed])}
              >
                {t("confirmSelected", { defaultValue: "Confirm selected" })}
              </button>
              {!anamnesisOk ? (
                <p className={`text-[12px] text-amber-700`}>
                  {t("anamnesisRequiredForConfirm", {
                    defaultValue: "Fill anamnesis for this course before confirming procedures.",
                  })}
                </p>
              ) : (
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {t("firstDayConfirmHint", {
                  defaultValue: "First day: confirm 2–3 procedures (FIFO prefix).",
                })}
              </p>
              )}
            </div>
          );
        })()}
        <DayTimeline
          days={planDays}
          locale={dayLocale}
          uiLocale={locale}
          todayWord={t("today")}
          empty={t("planEmpty")}
          loading={planLoading}
          loadingLabel={tc("loading")}
          selectableProposed
          selectedProposed={selectedProposed}
          onToggleProposed={toggleProposed}
          physioById={physioById}
          physioCatalog={physioCatalog}
          physioPrograms={physioPrograms}
          physioSubstances={physioSubstances}
          physioLabels={physioLabels}
          onPhysioSitesChange={(id, siteIds) => void patchPhysio(id, { siteIds })}
          onPhysioModeChange={(id, siteApplyMode) => void patchPhysio(id, { siteApplyMode })}
          onPhysioNoteBlur={(id, note) => void patchPhysio(id, { note })}
          onPhysioLateralityChange={(id, siteId, laterality) =>
            void patchPhysio(id, { siteLaterality: { [siteId]: laterality } })
          }
          onPhysioFieldsChange={(id, physioFields) => void patchPhysio(id, { physioFields })}
          proposedLabel={t("statusProposed", { defaultValue: "PROPOSED" })}
        />
        {planHasMore ? (
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-3`}
            disabled={planLoading}
            onClick={() => void loadPlan(false)}
          >
            {t("loadMore")}
          </button>
        ) : null}
      </ModalShell>
      <PrintLanguageDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        href={printHref}
      />
    </div>
  );
}

function mergeDays(prev: TimelineDay[], next: TimelineDay[]): TimelineDay[] {
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
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
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

function DayTimeline({
  days,
  locale,
  uiLocale,
  todayWord,
  empty,
  loading,
  loadingLabel,
  selectableProposed,
  selectedProposed,
  onToggleProposed,
  physioById,
  physioCatalog,
  physioPrograms,
  physioSubstances,
  physioLabels,
  onPhysioSitesChange,
  onPhysioModeChange,
  onPhysioNoteBlur,
  onPhysioLateralityChange,
  onPhysioFieldsChange,
  proposedLabel,
}: {
  days: TimelineDay[];
  locale: string;
  uiLocale: string;
  todayWord: string;
  empty: string;
  loading: boolean;
  loadingLabel: string;
  selectableProposed?: boolean;
  selectedProposed?: Set<string>;
  onToggleProposed?: (orderId: string) => void;
  physioById?: Record<string, PhysioChipsValue>;
  physioCatalog?: PhysioCatalogSite[];
  physioPrograms?: PhysioCatalogListItem[];
  physioSubstances?: PhysioCatalogListItem[];
  physioLabels?: PhysioChipsLabels;
  onPhysioSitesChange?: (orderId: string, siteIds: string[]) => void;
  onPhysioModeChange?: (orderId: string, mode: "TOGETHER" | "TURN") => void;
  onPhysioNoteBlur?: (orderId: string, note: string) => void;
  onPhysioLateralityChange?: (
    orderId: string,
    siteId: string,
    laterality: "LEFT" | "RIGHT" | "BOTH" | null,
  ) => void;
  onPhysioFieldsChange?: (orderId: string, fields: PhysioChipsValue["physioFields"]) => void;
  proposedLabel?: string;
}) {
  if (loading && days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{loadingLabel}</p>;
  }
  if (days.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{empty}</p>;
  }
  return (
    <ol className="max-h-[60vh] space-y-6 overflow-y-auto border-l-2 border-slate-200 pl-4">
      {days.map((day) => (
        <li key={day.date}>
          <h3 className="mb-2 text-[13px] font-semibold">
            {formatDay(day.date, locale, todayWord, day.labelHint === "today")}
          </h3>
          <ul className="space-y-2">
            {day.events.map((ev) => {
              const oid = orderIdFromEvent(ev);
              const isProposed = ev.status === "PROPOSED";
              return (
                <li
                  key={ev.id}
                  className={`rounded border p-2 text-[13px] ${
                    isProposed
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-emerald-100 bg-emerald-50/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {selectableProposed && isProposed && oid ? (
                      <input
                        type="checkbox"
                        className={`mt-1 ${MODAL_CHECKBOX_CLASS}`}
                        checked={selectedProposed?.has(oid) ?? false}
                        onChange={() => onToggleProposed?.(oid)}
                      />
                    ) : (
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      {ev.href ? (
                        <Link href={ev.href} className={`font-medium ${LINK_ACCENT_CLASS}`}>
                          {eventTitle(ev, uiLocale)}
                        </Link>
                      ) : (
                        <span className="font-medium">{eventTitle(ev, uiLocale)}</span>
                      )}
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {ev.subtitle} · {isProposed ? proposedLabel ?? ev.status : ev.status}
                      </p>
                      {oid && physioLabels && (isProposed || ev.status === "SCHEDULED") ? (
                        <PhysioSiteChips
                          value={physioById?.[oid] ?? ev.physio ?? EMPTY_PHYSIO}
                          catalog={physioCatalog ?? []}
                          programs={physioPrograms ?? []}
                          substances={physioSubstances ?? []}
                          locale={uiLocale}
                          editable={isProposed || ev.status === "SCHEDULED"}
                          labels={physioLabels}
                          onSitesChange={(siteIds) => onPhysioSitesChange?.(oid, siteIds)}
                          onModeChange={(mode) => onPhysioModeChange?.(oid, mode)}
                          onNoteBlur={(note) => onPhysioNoteBlur?.(oid, note)}
                          onLateralityChange={(siteId, laterality) =>
                            onPhysioLateralityChange?.(oid, siteId, laterality)
                          }
                          onFieldsChange={(fields) => onPhysioFieldsChange?.(oid, fields)}
                        />
                      ) : null}
                      {ev.resultSummary && ev.resultSummary.length > 0 ? (
                        <dl className="mt-1 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-3">
                          {ev.resultSummary.map((line) => (
                            <div key={`${ev.id}-${line.code}`}>
                              <span className="text-slate-500">{line.code}: </span>
                              <span className="font-medium">{line.value}</span>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
