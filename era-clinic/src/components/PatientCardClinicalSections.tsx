"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import type { L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";

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
};

type TimelineDay = {
  date: string;
  labelHint: string;
  events: TimelineEvent[];
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
      name: string;
      code: string;
      status: string;
    } | null;
    pendingLabs: { count: number; items: TimelineEvent[] };
  };
  resultsPreview: TimelineEvent[];
  planPreview: TimelineEvent[];
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
};

export function PatientCardClinicalSections({ patientRefId, panel }: Props) {
  const t = useTranslations("patientCard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dayLocale = locale.startsWith("az") ? "az-AZ" : locale.startsWith("ru") ? "ru-RU" : "en-GB";

  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(panel === "history");
  const [planOpen, setPlanOpen] = useState(panel === "plan");

  const [histTypes, setHistTypes] = useState("lab_order");
  const [labFilter, setLabFilter] = useState<"results" | "pending" | "all">("all");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("90");
  const [histDays, setHistDays] = useState<TimelineDay[]>([]);
  const [histOffset, setHistOffset] = useState(0);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  const [planDays, setPlanDays] = useState<TimelineDay[]>([]);
  const [planOffset, setPlanOffset] = useState(0);
  const [planHasMore, setPlanHasMore] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/patients/${patientRefId}/card-summary`);
    const data = await res.json();
    setSummary((data.data ?? data) as CardSummary);
    setLoading(false);
  }, [patientRefId]);

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
        labFilter,
        offset: String(offset),
      });
      if (fromIso) params.set("from", fromIso);
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setHistDays((prev) => (reset ? days : mergeDays(prev, days)));
      setHistOffset(row.nextOffset ?? offset);
      setHistHasMore(Boolean(row.hasMore));
      setHistLoading(false);
    },
    [patientRefId, histTypes, labFilter, fromIso, histOffset],
  );

  const loadPlan = useCallback(
    async (reset: boolean) => {
      setPlanLoading(true);
      const offset = reset ? 0 : planOffset;
      const params = new URLSearchParams({
        section: "plan",
        offset: String(offset),
      });
      const res = await fetch(`/api/patients/${patientRefId}/card-feed?${params}`);
      const data = await res.json();
      const row = data.data ?? data;
      const days = (row.days ?? []) as TimelineDay[];
      setPlanDays((prev) => (reset ? days : mergeDays(prev, days)));
      setPlanOffset(row.nextOffset ?? offset);
      setPlanHasMore(Boolean(row.hasMore));
      setPlanLoading(false);
    },
    [patientRefId, planOffset],
  );

  useEffect(() => {
    if (historyOpen) void loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open + filters only
  }, [historyOpen, histTypes, labFilter, period]);

  useEffect(() => {
    if (planOpen) void loadPlan(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOpen]);

  if (loading || !summary) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>;
  }

  const { nowNext, resultsPreview, planPreview } = summary;
  const pending = nowNext.pendingLabs;

  return (
    <div className="space-y-6">
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("nowNextTitle")}
        </h2>
        {!nowNext.nextAppointment &&
        !nowNext.activeEpisode &&
        !nowNext.nextProcedure &&
        pending.count === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("nowNextEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {nowNext.nextAppointment ? (
              <li className="rounded border border-amber-200 bg-amber-50/60 px-3 py-2">
                <span className="font-medium">{t("nextAppointment")}: </span>
                {nowNext.nextAppointment.practitionerName} ·{" "}
                {new Date(nowNext.nextAppointment.at).toLocaleString()} ({nowNext.nextAppointment.status})
                <Link href={nowNext.nextAppointment.href} className="ml-2 text-[#2980B9] hover:underline">
                  {t("open")}
                </Link>
              </li>
            ) : null}
            {nowNext.activeEpisode ? (
              <li className="rounded border border-rose-200 bg-rose-50/50 px-3 py-2">
                <span className="font-medium">{t("activeEpisode")}: </span>
                {nowNext.activeEpisode.programCode ?? nowNext.activeEpisode.id.slice(0, 8)}
                {nowNext.activeEpisode.roomNumber
                  ? ` · ${t("room")} ${nowNext.activeEpisode.roomNumber}`
                  : ""}
                <Link href={nowNext.activeEpisode.href} className="ml-2 text-[#2980B9] hover:underline">
                  {t("openDayPlan")}
                </Link>
              </li>
            ) : null}
            {nowNext.nextProcedure ? (
              <li className="rounded border px-3 py-2">
                <span className="font-medium">{t("nextProcedure")}: </span>
                {nowNext.nextProcedure.name} · {new Date(nowNext.nextProcedure.at).toLocaleString()}
              </li>
            ) : null}
            {pending.count > 0 ? (
              <li className="rounded border border-violet-300 bg-violet-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium text-violet-900">{t("pendingLabs")}: </span>
                    {t("pendingLabsCount", { count: pending.count })}
                  </span>
                  <button
                    type="button"
                    className={`${SECONDARY_BUTTON_CLASS} !px-2 !py-1 text-[11px]`}
                    onClick={() => {
                      setHistTypes("lab_order");
                      setLabFilter("pending");
                      setHistoryOpen(true);
                    }}
                  >
                    {t("showPending")}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] text-violet-950">
                  {pending.items.map((ev) => (
                    <li key={ev.id}>
                      {ev.href ? (
                        <Link href={ev.href} className="hover:underline">
                          {eventTitle(ev, locale)} · {ev.status}
                        </Link>
                      ) : (
                        <span>
                          {eventTitle(ev, locale)} · {ev.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("resultsTitle")}
          </h2>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setLabFilter("all");
              setHistTypes("lab_order,visit");
              setHistoryOpen(true);
            }}
          >
            {t("openHistory")}
          </button>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {resultsPreview.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("resultsEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {resultsPreview.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-[13px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div className="min-w-0 flex-1">
                    {ev.href ? (
                      <Link href={ev.href} className="font-medium text-[#2980B9] hover:underline">
                        {eventTitle(ev, locale)}
                      </Link>
                    ) : (
                      <span className="font-medium">{eventTitle(ev, locale)}</span>
                    )}
                    <p className="text-[12px] text-[#7F8C8D]">
                      {ev.subtitle} · {ev.status}
                      {ev.hasCritical ? (
                        <span className="ml-2 text-red-600">{t("critical")}</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
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
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          {planPreview.length === 0 ? (
            <p className="text-[13px] text-[#7F8C8D]">{t("planEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {planPreview.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-[13px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div>
                    <span className="font-medium">{eventTitle(ev, locale)}</span>
                    <p className="text-[12px] text-[#7F8C8D]">
                      {ev.subtitle} · {ev.status}
                    </p>
                  </div>
                </li>
              ))}
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
          <select
            className={MODAL_INPUT_CLASS}
            value={histTypes}
            onChange={(e) => setHistTypes(e.target.value)}
          >
            <option value="lab_order">{t("filterLab")}</option>
            <option value="lab_order,visit">{t("filterLabVisit")}</option>
            <option value="visit">{t("filterVisit")}</option>
            <option value="appointment">{t("filterAppointment")}</option>
            <option value="lab_order,visit,appointment">{t("filterAllTypes")}</option>
          </select>
          <select
            className={MODAL_INPUT_CLASS}
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value as "results" | "pending" | "all")}
          >
            <option value="all">{t("labAll")}</option>
            <option value="results">{t("labResults")}</option>
            <option value="pending">{t("labPending")}</option>
          </select>
          <select
            className={MODAL_INPUT_CLASS}
            value={period}
            onChange={(e) => setPeriod(e.target.value as "7" | "30" | "90" | "all")}
          >
            <option value="7">{t("period7")}</option>
            <option value="30">{t("period30")}</option>
            <option value="90">{t("period90")}</option>
            <option value="all">{t("periodAll")}</option>
          </select>
        </div>
        <DayTimeline
          days={histDays}
          locale={dayLocale}
          uiLocale={locale}
          todayWord={t("today")}
          empty={t("historyEmpty")}
          loading={histLoading}
          loadingLabel={tc("loading")}
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
        <p className="mt-2 text-[11px] text-[#7F8C8D]">{t("tzHint")}</p>
      </ModalShell>

      <ModalShell
        open={planOpen}
        title={t("planModalTitle")}
        onClose={() => setPlanOpen(false)}
        closeLabel={tc("close")}
      >
        {nowNext.activeEpisode ? (
          <p className="mb-3 text-[13px]">
            <Link href={nowNext.activeEpisode.href} className="text-[#2980B9] hover:underline">
              {t("openDayPlan")}
            </Link>
          </p>
        ) : null}
        <DayTimeline
          days={planDays}
          locale={dayLocale}
          uiLocale={locale}
          todayWord={t("today")}
          empty={t("planEmpty")}
          loading={planLoading}
          loadingLabel={tc("loading")}
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

function DayTimeline({
  days,
  locale,
  uiLocale,
  todayWord,
  empty,
  loading,
  loadingLabel,
}: {
  days: TimelineDay[];
  locale: string;
  uiLocale: string;
  todayWord: string;
  empty: string;
  loading: boolean;
  loadingLabel: string;
}) {
  if (loading && days.length === 0) {
    return <p className="text-[13px] text-[#7F8C8D]">{loadingLabel}</p>;
  }
  if (days.length === 0) {
    return <p className="text-[13px] text-[#7F8C8D]">{empty}</p>;
  }
  return (
    <ol className="max-h-[60vh] space-y-6 overflow-y-auto border-l-2 border-slate-200 pl-4">
      {days.map((day) => (
        <li key={day.date}>
          <h3 className="mb-2 text-[13px] font-semibold">
            {formatDay(day.date, locale, todayWord, day.labelHint === "today")}
          </h3>
          <ul className="space-y-2">
            {day.events.map((ev) => (
              <li key={ev.id} className="rounded border p-2 text-[13px]">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                  <div className="min-w-0 flex-1">
                    {ev.href ? (
                      <Link href={ev.href} className="font-medium text-[#2980B9] hover:underline">
                        {eventTitle(ev, uiLocale)}
                      </Link>
                    ) : (
                      <span className="font-medium">{eventTitle(ev, uiLocale)}</span>
                    )}
                    <p className="text-[12px] text-[#7F8C8D]">
                      {ev.subtitle} · {ev.status}
                    </p>
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
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
