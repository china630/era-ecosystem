'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  BarChart3,
  CalendarRange,
  Percent,
  TrendingUp,
  BedDouble,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

type ForecastDay = {
  date: string;
  roomsTotal: number;
  roomsSold: number;
  roomsAvailable: number;
  occupancyPct: number;
};

type ForecastData = {
  from: string;
  days: number;
  daily: ForecastDay[];
  summary: {
    avgOccupancyPct: number;
    peakOccupancyPct: number;
    peakDate: string | null;
  };
};

const HORIZONS = [7, 14, 30, 90] as const;

function SummaryCard({
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
    <div className="flex gap-3 rounded-xl border border-[#D5DADF]/80 bg-gradient-to-br from-white to-[#F8FAFC] p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[#34495E]">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-[#7F8C8D]">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function ForecastDashboard() {
  const t = useTranslations('forecastDashboard');
  const tc = useTranslations('common');
  const [days, setDays] = useState<number>(14);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/executive/forecast?days=${days}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      setData(json as ForecastData);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('loadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxPct = Math.max(100, ...(data?.daily.map((d) => d.occupancyPct) ?? [0]));

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/executive"
            className="mb-2 inline-flex items-center gap-1 text-[13px] text-[#2980B9] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('backExecutive')}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#34495E]">
            <TrendingUp className="h-7 w-7 text-[#2980B9]" aria-hidden />
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 hidden items-center gap-1 text-[11px] font-semibold uppercase text-[#7F8C8D] sm:inline-flex">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            {t('horizonLabel')}
          </span>
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setDays(h)}
              className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${
                days === h
                  ? 'border-[#2980B9] bg-[#2980B9] text-white'
                  : 'border-[#D5DADF] bg-white text-[#34495E] hover:bg-[#F8FAFC]'
              }`}
            >
              {t('horizonDays', { count: h })}
            </button>
          ))}
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('load')}
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-[13px] text-red-600">{error}</p> : null}
      {loading ? <p className="text-[#7F8C8D]">{tc('loading')}</p> : null}

      {data ? (
        <>
          <div className={`${CARD_CONTAINER_CLASS} mb-5 overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-[#D5DADF] bg-[#F8FAFC] px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2980B9]/10 text-[#2980B9]">
                <BarChart3 className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#34495E]">
                {t('summary.title')}
              </h2>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <SummaryCard
                icon={Percent}
                iconClass="bg-[#2980B9]/10 text-[#2980B9]"
                label={t('summary.avg')}
                value={`${data.summary.avgOccupancyPct}%`}
              />
              <SummaryCard
                icon={TrendingUp}
                iconClass="bg-emerald-500/10 text-emerald-700"
                label={t('summary.peak')}
                value={`${data.summary.peakOccupancyPct}%`}
              />
              <SummaryCard
                icon={CalendarRange}
                iconClass="bg-violet-500/10 text-violet-700"
                label={t('summary.peakDate')}
                value={data.summary.peakDate?.slice(5) ?? '—'}
                hint={data.summary.peakDate ?? undefined}
              />
            </div>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-[#D5DADF] bg-[#F8FAFC] px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
                <BedDouble className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#34495E]">
                {t('chart.title')}
              </h2>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="flex min-w-[640px] items-end gap-1" style={{ height: '200px' }}>
                {data.daily.map((d) => {
                  const h = Math.max(4, (d.occupancyPct / maxPct) * 180);
                  const hot = d.occupancyPct >= 85;
                  const warm = d.occupancyPct >= 60 && d.occupancyPct < 85;
                  const barColor = hot
                    ? 'bg-amber-500'
                    : warm
                      ? 'bg-[#2980B9]'
                      : 'bg-slate-300';
                  return (
                    <div
                      key={d.date}
                      className="flex flex-1 flex-col items-center justify-end gap-1"
                      title={`${d.date}: ${d.occupancyPct}% (${d.roomsSold}/${d.roomsTotal})`}
                    >
                      <span className="text-[9px] font-semibold text-[#7F8C8D]">{d.occupancyPct}%</span>
                      <div className={`w-full max-w-[28px] rounded-t ${barColor}`} style={{ height: h }} />
                      <span className="text-[9px] text-[#7F8C8D]">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`${CARD_CONTAINER_CLASS} mt-4 overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-[#D5DADF] bg-[#F8FAFC] px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600">
                <CalendarRange className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#34495E]">
                {t('table.title')}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#D5DADF] bg-[#F8FAFC] text-left text-[#7F8C8D]">
                    <th className="px-3 py-2">{t('table.date')}</th>
                    <th className="px-3 py-2">{t('table.sold')}</th>
                    <th className="px-3 py-2">{t('table.available')}</th>
                    <th className="px-3 py-2">
                      <Percent className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                      {t('table.occupancy')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.date} className="border-b border-[#D5DADF]/60 hover:bg-[#F8FAFC]/80">
                      <td className="px-3 py-2 font-medium">{d.date}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {d.roomsSold} / {d.roomsTotal}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{d.roomsAvailable}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{d.occupancyPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
