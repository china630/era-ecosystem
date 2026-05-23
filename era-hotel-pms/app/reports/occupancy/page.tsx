'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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
  if (available < 0) return 'bg-rose-50 text-rose-800';
  if (available <= 2) return 'bg-amber-50 text-amber-900';
  return 'bg-[#F1F5F9] text-[#34495E]';
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
      <AppShell maxWidthClass="max-w-6xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-6xl">
      <PageHeader
        title={t('occupancyTitle')}
        subtitle={t('occupancySubtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => setDays(14)}
              className={days === 14 ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            >
              {t('days14')}
            </button>
            <button
              type="button"
              onClick={() => setDays(30)}
              className={days === 30 ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            >
              {t('days30')}
            </button>
          </>
        }
      />

      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('legend')}</p>

      {error && <p className="mb-4 text-[13px] text-rose-600">{error}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>}

      {grid && !loading && (
        <PageSection className="p-0">
          <div className={`${DATA_TABLE_VIEWPORT_CLASS} rounded-none border-0 shadow-none`}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={`${DATA_TABLE_TH_LEFT_CLASS} sticky left-0 z-10 bg-[#F8FAFC]`}>{t('type')}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('avgPct')}</th>
                  {grid.dates.map((d) => (
                    <th key={d} className={`${DATA_TABLE_TH_LEFT_CLASS} whitespace-nowrap`}>
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.roomTypeId} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} sticky left-0 z-10 bg-white font-medium`}>
                      {row.code}
                      <span className="block text-[#7F8C8D]">{row.name}</span>
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>{row.avgOccupancyPct}%</td>
                    {row.cells.map((c) => (
                      <td
                        key={c.date}
                        className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap text-center ${cellClass(c.available)}`}
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
        </PageSection>
      )}
    </AppShell>
  );
}

export default function OccupancyReportPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<div className="p-8 text-[#7F8C8D]">{tc('loading')}</div>}>
      <OccupancyContent />
    </Suspense>
  );
}
