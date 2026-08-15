"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  LayoutGrid,
  ListOrdered,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  LINK_ACCENT_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from "@era/satellite-kit/ui";
import { CLINIC_PRESET, type ClinicPresetCode } from "@/domain/presets/clinic-presets";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type OpsDaySummary = {
  date: string;
  appointments: { total: number; byStatus: Record<string, number> };
  procedures: {
    total: number;
    byStatus: Record<string, number>;
    byType: Array<{
      procedureTypeId: string | null;
      code: string;
      name: string;
      count: number;
    }>;
  };
  visits: { inProgress: number; completedToday: number };
  labs: { open: number; resultReady: number; completedToday: number };
  queue: { waiting: number; called: number };
  overdueProcedures: number;
  inpatient?: { occupiedBeds: number; freeBeds: number };
};

/** Primary-tint icon / chip surface (kit L1 strongBlue). */
const ACCENT_SURFACE_CLASS = "bg-[#2980B9]/10 text-[#2980B9]";

const STATUS_CHIP: Record<string, string> = {
  SCHEDULED: ACCENT_SURFACE_CLASS,
  CHECKED_IN: `bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`,
  IN_PROGRESS: "bg-sky-500/10 text-sky-700",
  COMPLETED: "bg-slate-500/10 text-slate-700",
  NO_SHOW: "bg-amber-500/10 text-amber-800",
  CANCELLED: `bg-[#E74C3C]/10 ${TEXT_DANGER_CLASS}`,
  WAITING: "bg-orange-500/10 text-orange-700",
  CALLED: "bg-violet-500/10 text-violet-700",
  ORDERED: ACCENT_SURFACE_CLASS,
  COLLECTED: "bg-teal-500/10 text-teal-700",
  RESULT_READY: `bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`,
  PUBLISHED: "bg-indigo-500/10 text-indigo-700",
};

function SectionPanel({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EBEDF0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ACCENT_SURFACE_CLASS}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="truncate text-[13px] font-semibold text-[#34495E]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricTile({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "warn" | "danger" | "default";
}) {
  const toneWrap =
    tone === "danger"
      ? "border-red-300/80 bg-red-50/80"
      : tone === "warn"
        ? "border-amber-300/80 bg-amber-50/70"
        : "border-[#D5DADF]/80 bg-[#F8FAFC]";

  const body = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-[#34495E]">{value}</p>
        {hint ? <p className={`mt-0.5 text-[11px] leading-snug ${TEXT_MUTED_CLASS}`}>{hint}</p> : null}
      </div>
    </>
  );

  const className = `flex gap-3 rounded-xl border p-3 transition ${toneWrap} ${
    href ? "hover:border-[#2980B9]/60 hover:shadow-sm" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function StatusRows({
  byStatus,
  emptyLabel,
  statusLabel,
}: {
  byStatus: Record<string, number>;
  emptyLabel: string;
  statusLabel: (status: string) => string;
}) {
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>;
  }
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <ul className="space-y-2.5">
      {entries.map(([status, count]) => {
        const chip = STATUS_CHIP[status] ?? "bg-slate-500/10 text-slate-700";
        const pct = Math.round((count / max) * 100);
        return (
          <li key={status} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
                {statusLabel(status)}
              </span>
              <span className="font-semibold tabular-nums text-[#34495E]">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#EBEDF0]">
              <div className="h-full rounded-full bg-[#2980B9]/70" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  iconClass,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  iconClass: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border border-[#D5DADF]/80 bg-white px-3 py-2.5 text-[13px] font-medium text-[#34495E] transition hover:border-[#2980B9]/50 hover:bg-[#F8FAFC]"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </Link>
  );
}

export function OpsHomeDashboard({
  date,
  refreshKey = 0,
}: {
  date: string;
  refreshKey?: number;
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const enabledPresets: ClinicPresetCode[] = auth?.enabledPresets ?? [CLINIC_PRESET.OUTPATIENT];
  const hasSanatorium = enabledPresets.includes(CLINIC_PRESET.SANATORIUM_CLINICAL);
  const hasInpatient = enabledPresets.includes(CLINIC_PRESET.INPATIENT_DAY);

  const [summary, setSummary] = useState<OpsDaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const statusLabel = useCallback(
    (status: string) => {
      const known = [
        "SCHEDULED",
        "CHECKED_IN",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
        "CANCELLED",
        "WAITING",
        "CALLED",
        "ORDERED",
        "COLLECTED",
        "RESULT_READY",
        "PUBLISHED",
      ] as const;
      if ((known as readonly string[]).includes(status)) {
        return t(`status.${status}` as "status.SCHEDULED");
      }
      return status;
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date, locale });
    const res = await fetch(`/api/ops/day-summary?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("loadFailed"));
      setSummary(null);
    } else {
      setSummary((data.data ?? data) as OpsDaySummary);
    }
    setLoading(false);
  }, [date, locale, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>;
  }

  if (error && !summary) {
    return <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{error}</p>;
  }

  if (!summary) {
    return <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("loadFailed")}</p>;
  }

  const overdueTone =
    summary.overdueProcedures > 5 ? "danger" : summary.overdueProcedures > 0 ? "warn" : "default";
  const overdueIconClass =
    overdueTone === "danger"
      ? `bg-[#E74C3C]/15 ${TEXT_DANGER_CLASS}`
      : overdueTone === "warn"
        ? "bg-amber-500/15 text-amber-700"
        : "bg-slate-500/10 text-slate-600";

  return (
    <div className="space-y-5">
      {error ? <p className={`text-xs ${TEXT_DANGER_CLASS}`}>{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricTile
          icon={Stethoscope}
          iconClass={ACCENT_SURFACE_CLASS}
          label={t("kpiAppointments")}
          value={summary.appointments.total}
          hint={t("kpiAppointmentsHint")}
          href="/appointments"
        />
        <MetricTile
          icon={Syringe}
          iconClass="bg-teal-500/10 text-teal-700"
          label={t("kpiProcedures")}
          value={summary.procedures.total}
          hint={t("kpiProceduresHint")}
          href="/nurse"
        />
        <MetricTile
          icon={ListOrdered}
          iconClass="bg-orange-500/10 text-orange-700"
          label={t("kpiQueueWaiting")}
          value={summary.queue.waiting}
          hint={t("kpiQueueHint", { called: summary.queue.called })}
          href="/reception/queue"
        />
        <MetricTile
          icon={FlaskConical}
          iconClass="bg-violet-500/10 text-violet-700"
          label={t("kpiOpenLabs")}
          value={summary.labs.open}
          hint={t("kpiLabsHint", { ready: summary.labs.resultReady })}
          href="/lab-orders"
        />
        <MetricTile
          icon={AlertTriangle}
          iconClass={overdueIconClass}
          label={t("kpiOverdue")}
          value={summary.overdueProcedures}
          hint={t("kpiOverdueHint")}
          href="/nurse"
          tone={overdueTone}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionPanel icon={ClipboardList} title={t("appointmentsByStatus")}>
          <StatusRows
            byStatus={summary.appointments.byStatus}
            emptyLabel={t("emptyDay")}
            statusLabel={statusLabel}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#EBEDF0] pt-3">
            <div className={`${SUBSECTION_SURFACE_CLASS} rounded-xl px-3 py-2`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                {t("visitsInProgress")}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">
                {summary.visits.inProgress}
              </p>
            </div>
            <div className={`${SUBSECTION_SURFACE_CLASS} rounded-xl px-3 py-2`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                {t("visitsCompleted")}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">
                {summary.visits.completedToday}
              </p>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel icon={Syringe} title={t("proceduresByStatus")}>
          <StatusRows
            byStatus={summary.procedures.byStatus}
            emptyLabel={t("emptyDay")}
            statusLabel={statusLabel}
          />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EBEDF0] pt-3">
            <div className={`${SUBSECTION_SURFACE_CLASS} rounded-xl px-3 py-2`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                {t("labsOpenShort")}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">{summary.labs.open}</p>
            </div>
            <div className={`${SUBSECTION_SURFACE_CLASS} rounded-xl px-3 py-2`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                {t("labsReadyShort")}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">
                {summary.labs.resultReady}
              </p>
            </div>
            <div className={`${SUBSECTION_SURFACE_CLASS} rounded-xl px-3 py-2`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${TEXT_MUTED_CLASS}`}>
                {t("labsDoneShort")}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#34495E]">
                {summary.labs.completedToday}
              </p>
            </div>
          </div>
        </SectionPanel>
      </div>

      <SectionPanel icon={LayoutGrid} title={t("proceduresByType")}>
        {summary.procedures.byType.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("emptyDay")}</p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                  <th className={`${DATA_TABLE_TH_RIGHT_CLASS} text-right`}>{t("colCount")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.procedures.byType.map((row) => (
                  <tr key={`${row.code}-${row.name}`} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[12px] ${TEXT_MUTED_CLASS}`}>
                      {row.code}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right font-semibold tabular-nums`}>
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      {summary.inpatient ? (
        <SectionPanel
          icon={BedDouble}
          title={t("inpatientTitle")}
          action={
            <Link href="/inpatient" className={`text-[12px] ${LINK_ACCENT_CLASS}`}>
              {t("linkInpatient")}
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile
              icon={Users}
              iconClass={ACCENT_SURFACE_CLASS}
              label={t("bedsOccupied")}
              value={summary.inpatient.occupiedBeds}
            />
            <MetricTile
              icon={CheckCircle2}
              iconClass={`bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`}
              label={t("bedsFree")}
              value={summary.inpatient.freeBeds}
            />
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel icon={LayoutGrid} title={t("quickLinks")}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/appointments"
            icon={Stethoscope}
            label={t("linkAppointments")}
            iconClass={ACCENT_SURFACE_CLASS}
          />
          <QuickLink
            href="/nurse"
            icon={Syringe}
            label={t("linkNurse")}
            iconClass="bg-teal-500/10 text-teal-700"
          />
          <QuickLink
            href="/reception/queue"
            icon={ListOrdered}
            label={t("linkQueue")}
            iconClass="bg-orange-500/10 text-orange-700"
          />
          <QuickLink
            href="/lab-orders"
            icon={FlaskConical}
            label={t("linkLabs")}
            iconClass="bg-violet-500/10 text-violet-700"
          />
          {hasSanatorium ? (
            <QuickLink
              href="/sanatorium/resources"
              icon={LayoutGrid}
              label={t("linkResources")}
              iconClass="bg-pink-500/10 text-pink-700"
            />
          ) : null}
          {hasInpatient ? (
            <QuickLink
              href="/inpatient"
              icon={BedDouble}
              label={t("linkInpatient")}
              iconClass="bg-indigo-500/10 text-indigo-700"
            />
          ) : null}
        </div>
      </SectionPanel>
    </div>
  );
}