"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  LINK_ACCENT_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
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
  codes?: string[];
  hasCritical?: boolean;
  resultSummary?: Array<{ code: string; value: string; flag?: string }>;
};

type TimelineDay = {
  date: string;
  labelHint: string;
  events: TimelineEvent[];
};

const FILTERS = ["all", "visit", "lab_order", "procedure", "appointment", "episode"] as const;

function typeDot(type: string): string {
  switch (type) {
    case "lab_order":
      return "bg-violet-500";
    case "visit":
      return "bg-sky-500";
    case "procedure":
      return "bg-emerald-500";
    case "appointment":
      return "bg-amber-500";
    case "episode":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

function formatDayLabel(date: string, locale: string, todayHint: boolean, todayWord: string): string {
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
  return todayHint ? `${todayWord} · ${formatted}` : formatted;
}

export function PatientClinicalTimeline({ patientRefId }: { patientRefId: string }) {
  const t = useTranslations("patientTimeline");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [days, setDays] = useState<TimelineDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [error, setError] = useState("");

  function eventTitle(ev: TimelineEvent): string {
    if (ev.titleL10n) {
      const codes = ev.codes?.length ? ` (${ev.codes.join(", ")})` : "";
      return `${pickL10n(ev.titleL10n, locale)}${codes}`;
    }
    return ev.title;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filter !== "all") params.set("types", filter);
    params.set("limitDays", "90");
    const res = await fetch(`/api/patients/${patientRefId}/timeline?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("loadFailed"));
      setDays([]);
      setLoading(false);
      return;
    }
    const row = data.data ?? data;
    setDays(row.days ?? []);
    setLoading(false);
  }, [patientRefId, filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayLocale = locale.startsWith("az")
    ? "az-AZ"
    : locale.startsWith("ru")
      ? "ru-RU"
      : "en-GB";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("title")}
        </h2>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${filter === f ? CHIP_ACTIVE_CLASS : CHIP_CLASS} !px-2 !py-1 text-[11px]`}
              onClick={() => setFilter(f)}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} p-4 sm:p-6`}>
        {loading ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
        ) : error ? (
          <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{error}</p>
        ) : days.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("empty")}</p>
        ) : (
          <ol className="relative space-y-8 border-l-2 border-slate-200 pl-4 sm:pl-6">
            {days.map((day) => (
              <li key={day.date} className="relative">
                <span className="absolute -left-[1.4rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300 bg-white sm:-left-[1.9rem]">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                </span>
                <h3 className="mb-3 text-[14px] font-semibold text-slate-800">
                  {formatDayLabel(day.date, dayLocale, day.labelHint === "today", t("today"))}
                </h3>
                <ul className="space-y-3">
                  {day.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-[13px]"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${typeDot(ev.type)}`}
                          title={ev.type}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            {ev.href ? (
                              <Link
                                href={ev.href}
                                className={`font-medium ${LINK_ACCENT_CLASS}`}
                              >
                                {eventTitle(ev)}
                              </Link>
                            ) : (
                              <span className="font-medium">{eventTitle(ev)}</span>
                            )}
                            <span className="text-[11px] uppercase tracking-wide text-slate-500">
                              {ev.status}
                              {ev.hasCritical ? (
                                <span className={`ml-2 ${TEXT_DANGER_CLASS}`}>{t("critical")}</span>
                              ) : null}
                            </span>
                          </div>
                          {ev.subtitle ? (
                            <p className={`mt-0.5 text-[12px] ${TEXT_MUTED_CLASS}`}>{ev.subtitle}</p>
                          ) : null}
                          {ev.resultSummary && ev.resultSummary.length > 0 ? (
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                              {ev.resultSummary.map((line) => (
                                <div key={`${ev.id}-${line.code}`} className="text-[11px]">
                                  <dt className="inline text-slate-500">{line.code}: </dt>
                                  <dd
                                    className={`inline font-medium ${
                                      line.flag === "CRITICAL" || line.flag === "HIGH"
                                        ? "text-red-600"
                                        : line.flag === "LOW"
                                          ? "text-amber-600"
                                          : ""
                                    }`}
                                  >
                                    {line.value}
                                  </dd>
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
        )}
        <p className={`mt-4 text-[11px] ${TEXT_MUTED_CLASS}`}>{t("tzHint")}</p>
      </div>
    </section>
  );
}
