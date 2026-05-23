'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface OccupancyCell {
  date: string;
  total: number;
  sold: number;
  available: number;
}

interface OccupancyRow {
  roomTypeId: string;
  code: string;
  name: string;
  cells: OccupancyCell[];
  avgOccupancyPct: number;
}

interface OccupancyGrid {
  from: string;
  days: number;
  dates: string[];
  rows: OccupancyRow[];
}

function cellClass(available: number): string {
  if (available < 0) return 'bg-rose-950 text-rose-200';
  if (available <= 2) return 'bg-amber-950/80 text-amber-100';
  return 'bg-emerald-950/50 text-emerald-100';
}

function OccupancyContent() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = parseInt(searchParams.get('days') ?? '30', 10);

  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/occupancy?days=${days}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('loadError'));
      setGrid(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('error'));
    } finally {
      setLoading(false);
    }
  }, [days, tc]);

  useEffect(() => {
    load();
  }, [load]);

  function setDays(n: number) {
    router.push(`/reports/occupancy?days=${n}`);
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermissionReports')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AppNav />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t('occupancyTitle')}</h1>
          <p className="text-sm text-slate-400">{t('occupancySubtitle')}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setDays(14)}
            className={`rounded px-3 py-1 ${days === 14 ? 'bg-sky-700' : 'border border-slate-600'}`}
          >
            {t('days14')}
          </button>
          <button
            type="button"
            onClick={() => setDays(30)}
            className={`rounded px-3 py-1 ${days === 30 ? 'bg-sky-700' : 'border border-slate-600'}`}
          >
            {t('days30')}
          </button>
        </div>
      </header>

      <p className="mb-4 text-xs text-slate-500">
        {t('legend')}
      </p>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}
      {loading && <p className="text-slate-400">{tc('loading')}</p>}

      {grid && !loading && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900">
                <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2">{t('type')}</th>
                <th className="px-2 py-2 text-slate-500">{t('avgPct')}</th>
                {grid.dates.map((d) => (
                  <th key={d} className="whitespace-nowrap px-2 py-2 text-slate-400">
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.roomTypeId} className="border-t border-slate-800">
                  <td className="sticky left-0 z-10 bg-slate-950 px-3 py-2 font-medium">
                    {row.code}
                    <span className="block text-slate-500">{row.name}</span>
                  </td>
                  <td className="px-2 py-2 text-slate-400">{row.avgOccupancyPct}%</td>
                  {row.cells.map((c) => (
                    <td
                      key={c.date}
                      className={`whitespace-nowrap px-2 py-2 text-center ${cellClass(c.available)}`}
                      title={t('soldTitle', { sold: c.sold, total: c.total })}
                    >
                      {c.sold}/{c.total}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OccupancyReportPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">{tc('loading')}</div>}>
      <OccupancyContent />
    </Suspense>
  );
}
