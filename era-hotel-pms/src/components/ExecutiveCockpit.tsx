'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ConciergeBell,
  DoorOpen,
  DoorClosed,
  Hotel,
  LogIn,
  LogOut,
  Percent,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

export type CockpitData = {
  date: string;
  hotelStatus: 'NORMAL' | 'RISK' | 'CRITICAL';
  occupancy: {
    factPct: number;
    planPct: number;
    deviationPct: number;
    roomsFact: number;
    roomsPlan: number;
  };
  adrCompare: { today: number; yesterday: number; lastWeek: number };
  revparCompare: { today: number; yesterday: number; lastWeek: number };
  revenue: {
    today: number;
    mtd: number;
    ytd: number;
    roomToday: number;
    fbToday: number;
    spaToday: number;
    medicalToday: number;
    otherToday: number;
  };
  receivables: { total: number; overdue: number };
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
  clinicCapacity?: {
    bookingAllowed: boolean;
    riskLevel: string;
    guestEquivalent: number;
    remainingPct?: number;
    remainingSlots?: number;
    totalSlots?: number;
    message?: string;
    from?: string;
    to?: string;
  } | null;
};

const STATUS_STYLES = {
  NORMAL: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  RISK: 'bg-amber-100 text-amber-900 border-amber-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
} as const;

function money(v: number) {
  return `${v.toFixed(2)} AZN`;
}

function SectionPanel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD_CONTAINER_CLASS} overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#D5DADF] bg-[#F8FAFC] px-4 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2980B9]/10 text-[#2980B9]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#34495E]">{title}</h2>
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
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#D5DADF]/80 bg-[#FAFBFC] p-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-[#34495E]">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-[#7F8C8D]">{hint}</p> : null}
      </div>
    </div>
  );
}

function CompareTile({
  label,
  icon: Icon,
  today,
  yesterday,
  lastWeek,
  format,
}: {
  label: string;
  icon: LucideIcon;
  today: number;
  yesterday: number;
  lastWeek: number;
  format: (v: number) => string;
}) {
  const delta = today - yesterday;
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;
  const deltaClass = delta >= 0 ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="flex gap-3 rounded-xl border border-[#D5DADF]/80 bg-white p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums text-[#34495E]">{format(today)}</p>
          <span className={`inline-flex items-center gap-0.5 text-[12px] font-medium ${deltaClass}`}>
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
            {delta >= 0 ? '+' : ''}
            {format(delta)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-[#EBEDF0] pt-2 text-[12px]">
          <div>
            <dt className="text-[#7F8C8D]">−1d</dt>
            <dd className="font-medium tabular-nums text-[#34495E]">{format(yesterday)}</dd>
          </div>
          <div>
            <dt className="text-[#7F8C8D]">−7d</dt>
            <dd className="font-medium tabular-nums text-[#34495E]">{format(lastWeek)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function ExecutiveCockpit({ data }: { data: CockpitData }) {
  const t = useTranslations('executiveDashboard');
  const statusLabel = t(`status.${data.hotelStatus}`);
  const deviation = data.occupancy.deviationPct;
  const deviationClass =
    deviation >= 0 ? 'text-emerald-700' : deviation <= -10 ? 'text-red-600' : 'text-amber-700';

  const breakdown = [
    { key: 'room', val: data.revenue.roomToday, icon: Hotel, cls: 'bg-[#2980B9]/10 text-[#2980B9]' },
    { key: 'fb', val: data.revenue.fbToday, icon: UtensilsCrossed, cls: 'bg-orange-500/10 text-orange-700' },
    { key: 'spa', val: data.revenue.spaToday, icon: Sparkles, cls: 'bg-pink-500/10 text-pink-700' },
    { key: 'medical', val: data.revenue.medicalToday, icon: Stethoscope, cls: 'bg-teal-500/10 text-teal-700' },
  ] as const;

  return (
    <div className="min-w-0 space-y-5">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${STATUS_STYLES[data.hotelStatus]}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/60">
            <Building2 className="h-6 w-6 shrink-0" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide opacity-80">{t('hotelStatus')}</p>
            <p className="text-xl font-bold">{statusLabel}</p>
          </div>
        </div>
        <p className="max-w-md text-[12px] leading-snug opacity-90">{t(`statusHint.${data.hotelStatus}`)}</p>
      </div>

      {data.clinicCapacity && data.clinicCapacity.riskLevel !== 'ok' ? (
        <div
          className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 ${
            data.clinicCapacity.riskLevel === 'critical'
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <Stethoscope className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[12px] font-semibold uppercase tracking-wide">
              {t('clinicCapacity.title')} · {data.clinicCapacity.riskLevel}
              {data.clinicCapacity.remainingPct != null
                ? ` · ${data.clinicCapacity.remainingPct}% ${t('clinicCapacity.remaining')}`
                : ''}
            </p>
            <p className="text-[13px] leading-snug">
              {data.clinicCapacity.message ??
                t('clinicCapacity.fallback', {
                  pct: data.clinicCapacity.remainingPct ?? '—',
                })}
            </p>
            {!data.clinicCapacity.bookingAllowed ? (
              <p className="text-[12px] font-medium">{t('clinicCapacity.blocked')}</p>
            ) : (
              <p className="text-[12px]">{t('clinicCapacity.warnSoft')}</p>
            )}
          </div>
        </div>
      ) : null}

      <SectionPanel title={t('section.flash')} icon={CalendarClock}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#2980B9]/20 bg-gradient-to-br from-[#EBF5FB] to-white p-4 lg:col-span-1">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2980B9] text-white">
                <Percent className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {t('occupancy.title')}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[#2980B9]">
                  {data.occupancy.factPct}%
                </p>
                <dl className="mt-3 space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7F8C8D]">{t('occupancy.plan')}</dt>
                    <dd className="font-semibold tabular-nums">{data.occupancy.planPct}%</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-[#D5DADF]/60 pt-1.5">
                    <dt className="text-[#7F8C8D]">{t('occupancy.deviation')}</dt>
                    <dd className={`font-bold tabular-nums ${deviationClass}`}>
                      {deviation > 0 ? '+' : ''}
                      {deviation} pp
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#7F8C8D]">
                    <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {data.occupancy.roomsFact} / {data.occupancy.roomsPlan} {t('occupancy.roomsNote')}
                  </div>
                </dl>
              </div>
            </div>
          </div>
          <CompareTile
            label="ADR"
            icon={CircleDollarSign}
            today={data.adrCompare.today}
            yesterday={data.adrCompare.yesterday}
            lastWeek={data.adrCompare.lastWeek}
            format={money}
          />
          <CompareTile
            label="RevPAR"
            icon={Wallet}
            today={data.revparCompare.today}
            yesterday={data.revparCompare.yesterday}
            lastWeek={data.revparCompare.lastWeek}
            format={money}
          />
        </div>
      </SectionPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionPanel title={t('section.revenue')} icon={CircleDollarSign}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['today', data.revenue.today, 'bg-emerald-500/10 text-emerald-700'],
                  ['mtd', data.revenue.mtd, 'bg-[#2980B9]/10 text-[#2980B9]'],
                  ['ytd', data.revenue.ytd, 'bg-indigo-500/10 text-indigo-700'],
                ] as const
              ).map(([key, val, cls]) => (
                <MetricTile
                  key={key}
                  icon={Wallet}
                  iconClass={cls}
                  label={t(`revenue.${key}`)}
                  value={money(val)}
                />
              ))}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
                <ConciergeBell className="h-3.5 w-3.5" aria-hidden />
                {t('revenue.breakdownToday')}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {breakdown.map(({ key, val, icon: Icon, cls }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#EBEDF0] bg-white px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-[12px] text-[#34495E]">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${cls}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      {t(`revenue.${key}`)}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums">{money(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionPanel>

        <div className="space-y-5">
          <SectionPanel title={t('section.receivables')} icon={AlertTriangle}>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile
                icon={CircleDollarSign}
                iconClass="bg-slate-500/10 text-slate-700"
                label={t('receivables.total')}
                value={money(data.receivables.total)}
              />
              <MetricTile
                icon={AlertTriangle}
                iconClass="bg-amber-500/10 text-amber-700"
                label={t('receivables.overdue')}
                value={money(data.receivables.overdue)}
                hint={data.receivables.overdue > 0 ? t('receivables.overdueHint') : undefined}
              />
            </div>
          </SectionPanel>

          <SectionPanel title={t('section.operations')} icon={Activity}>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                icon={Users}
                iconClass="bg-[#2980B9]/10 text-[#2980B9]"
                label={t('kpi.guestsInHouse')}
                value={String(data.guestsInHouse)}
              />
              <MetricTile
                icon={LogIn}
                iconClass="bg-emerald-500/10 text-emerald-700"
                label={t('kpi.arrivalsToday')}
                value={String(data.arrivalsToday)}
              />
              <MetricTile
                icon={LogOut}
                iconClass="bg-orange-500/10 text-orange-700"
                label={t('kpi.departuresToday')}
                value={String(data.departuresToday)}
              />
            </div>
          </SectionPanel>
        </div>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-3`}>
        <span className="mr-1 flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D] sm:w-auto">
          <DoorOpen className="h-3.5 w-3.5" aria-hidden />
          {t('drill.title')}
        </span>
        <Link href="/executive/forecast" className={SECONDARY_BUTTON_CLASS}>
          <TrendingUp className="mr-1.5 inline h-4 w-4" aria-hidden />
          {t('drill.forecast')}
        </Link>
        <Link href="/" className={SECONDARY_BUTTON_CLASS}>
          <BedDouble className="mr-1.5 inline h-4 w-4" aria-hidden />
          {t('drill.rack')}
        </Link>
        <Link href="/in-house" className={SECONDARY_BUTTON_CLASS}>
          <Users className="mr-1.5 inline h-4 w-4" aria-hidden />
          {t('drill.inHouse')}
        </Link>
        <Link href="/operations" className={SECONDARY_BUTTON_CLASS}>
          <DoorClosed className="mr-1.5 inline h-4 w-4" aria-hidden />
          {t('drill.operations')}
        </Link>
      </div>
    </div>
  );
}
