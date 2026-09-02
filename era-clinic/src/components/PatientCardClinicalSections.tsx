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
};

const EMPTY_PHYSIO: PhysioChipsValue = {
  needsSite: true,
  physioOrderFields: [],
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

  const physioLabels: PhysioChipsLabels = useMemo(
    () => ({
      sites: t("physioSites", { defaultValue: "Sites" }),
      addSite: t("physioAddSite", { defaultValue: "Add site" }),
      applyMode: t("physioApplyMode", { defaultValue: "Apply" }),
      together: t("physioTogether", { defaultValue: "Together" }),
      turn: t("physioTurn", { defaultValue: "In turn" }),
      note: t("physioNote", { defaultValue: "Note" }),
      noteHint: t("physioNoteHint", { defaultValue: "Comments and unmatched leftover" }),
      remove: t("physioRemoveSite", { defaultValue: "Remove site" }),
      laterality: t("physioLaterality", { defaultValue: "Side" }),
      left: t("physioLeft", { defaultValue: "Left" }),
      right: t("physioRight", { defaultValue: "Right" }),
      both: t("physioBoth", { defaultValue: "Both" }),
      workKind: t("physioWorkKind", { defaultValue: "Work kind" }),
      deviceProgram: t("physioDeviceProgram", { defaultValue: "Program" }),
      electrodeCount: t("physioElectrodeCount", { defaultValue: "Electrodes" }),
      deviceParam: t("physioDeviceParam", { defaultValue: "Device param" }),
      noAdditive: t("physioNoAdditive", { defaultValue: "No additive" }),
      applicationSurface: t("physioApplicationSurface", { defaultValue: "Surface" }),
      substance: t("physioSubstance", { defaultValue: "Substance" }),
      extraOil: t("physioExtraOil", { defaultValue: "Extra oil" }),
      holdOrStop: t("physioHoldOrStop", { defaultValue: "Hold / stop" }),
      spineLevel: t("physioSpineLevel", { defaultValue: "Spine level" }),
      dayBlock: t("physioDayBlock", { defaultValue: "Day block" }),
      bathSequence: t("physioBathSequence", { defaultValue: "Bath sequence" }),
      naftalanFill: t("physioNaftalanFill", { defaultValue: "Naftalan fill" }),
      intensity: t("physioIntensity", { defaultValue: "Intensity" }),
      smear: t("physioSmear", { defaultValue: "Smear" }),
      yes: t("physioYes", { defaultValue: "Yes" }),
      no: t("physioNo", { defaultValue: "No" }),
      unset: t("physioUnset", { defaultValue: "—" }),
      surfaceFrontBack: t("physioSurfaceFrontBack", { defaultValue: "Front / back" }),
      surfaceUpper: t("physioSurfaceUpper", { defaultValue: "Upper" }),
      surfaceLower: t("physioSurfaceLower", { defaultValue: "Lower" }),
      dayBlockAlt: t("physioDayBlockAlt", { defaultValue: "Every other day" }),
      dayBlockThen: t("physioDayBlockThen", { defaultValue: "5 days then" }),
      bathSitzThenFull: t("physioBathSitzThenFull", { defaultValue: "Sitz then full" }),
      fillTam: t("physioFillTam", { defaultValue: "Full body (tam)" }),
      fillOturaq: t("physioFillOturaq", { defaultValue: "Sitz (oturaq)" }),
      fillQursaq: t("physioFillQursaq", { defaultValue: "To waist (qurşaq)" }),
      catalogEmpty: t("physioCatalogEmpty", {
        defaultValue: "Physio site catalog is not seeded.",
      }),
      catalogEmptyLink: t("physioCatalogEmptyLink", { defaultValue: "Open Physio sites" }),
      intensityLight: t("physioIntensityLight", { defaultValue: "Light" }),
      intensityWeak: t("physioIntensityWeak", { defaultValue: "Weak" }),
      intensityNotHot: t("physioIntensityNotHot", { defaultValue: "Not hot" }),
      intensityMedium: t("physioIntensityMedium", { defaultValue: "Medium" }),
      intensityMore: t("physioIntensityMore", { defaultValue: "More" }),
    }),
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
          siteIds: ev.physio.siteIds,
          siteApplyMode: ev.physio.siteApplyMode,
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("proposedPlanTitle", { defaultValue: "Proposed plan" })}
          </h2>
          {allProposedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
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
          ) : null}
        </div>
        {confirmMsg ? <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{confirmMsg}</p> : null}
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {proposedPreview.length === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
              {t("proposedEmpty", { defaultValue: "No proposed procedures awaiting confirmation." })}
            </p>
          ) : (
            <ul className="space-y-2">
              {proposedPreview.map((ev) => {
                const oid = orderIdFromEvent(ev);
                if (!oid) return null;
                return (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-start gap-2 rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      className={`mt-1 ${MODAL_CHECKBOX_CLASS}`}
                      checked={selectedProposed.has(oid)}
                      onChange={() => toggleProposed(oid)}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{eventTitle(ev, locale)}</span>
                      <p className="text-[12px] text-amber-800">
                        {ev.subtitle} · {t("statusProposed", { defaultValue: "PROPOSED" })}
                      </p>
                      <PhysioSiteChips
                        value={physioById[oid] ?? ev.physio ?? EMPTY_PHYSIO}
                        catalog={physioCatalog}
                        programs={physioPrograms}
                        substances={physioSubstances}
                        locale={locale}
                        editable
                        labels={physioLabels}
                        onSitesChange={(siteIds) => void patchPhysio(oid, { siteIds })}
                        onModeChange={(siteApplyMode) => void patchPhysio(oid, { siteApplyMode })}
                        onNoteBlur={(note) => void patchPhysio(oid, { note })}
                        onLateralityChange={(siteId, laterality) =>
                          void patchPhysio(oid, { siteLaterality: { [siteId]: laterality } })
                        }
                        onFieldsChange={(physioFields) => void patchPhysio(oid, { physioFields })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("planTitle")}
          </h2>
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
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {planPreview.length === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("planEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {planPreview.map((ev) => {
                const physio = ev.physio ?? (ev.id.startsWith("procedure:") ? physioById[ev.id.slice("procedure:".length)] : undefined);
                const siteLabels =
                  physio?.siteIds
                    ?.map((id) => {
                      const site = physioCatalog.find((s) => s.id === id);
                      if (!site) return null;
                      const loc = locale.startsWith("ru")
                        ? site.titleRu
                        : locale.startsWith("az")
                          ? site.titleAz
                          : site.titleEn;
                      return `${loc} / ${site.titleLa}`;
                    })
                    .filter(Boolean) ?? [];
                return (
                <li
                  key={ev.id}
                  className="flex items-start gap-2 rounded border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-[13px]"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{eventTitle(ev, locale)}</span>
                    <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {ev.subtitle} · {ev.status}
                    </p>
                    {siteLabels.length > 0 ? (
                      <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {t("physioSites", { defaultValue: "Sites" })}: {siteLabels.join(" · ")}
                      </p>
                    ) : physio?.needsSite ? (
                      <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {t("planSitesInFullPlan", {
                          defaultValue: "Sites — open full plan",
                        })}
                      </p>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

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
