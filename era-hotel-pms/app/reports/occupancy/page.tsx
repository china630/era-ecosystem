'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  FieldSelect,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
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

const CHART_COLORS = ['#2980B9', '#16A085', '#E67E22', '#8E44AD', '#C0392B', '#2C3E50', '#27AE60'];

function OccupancyLineChart({ grid, title }: { grid: OccupancyGrid; title: string }) {
  const width = 720;
  const height = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = Math.max(grid.dates.length - 1, 1);

  function pct(cell: OccupancyCell): number {
    if (cell.total <= 0) return 0;
    return Math.min(100, Math.max(0, (cell.sold / cell.total) * 100));
  }

  function xAt(i: number): number {
    return padL + (i / n) * innerW;
  }

  function yAt(value: number): number {
    return padT + innerH - (value / 100) * innerH;
  }

  return (
    <section className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
      <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{title}</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-4xl" role="img" aria-label={title}>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="#E5E8EB"
              strokeWidth={1}
            />
            <text x={padL - 6} y={yAt(tick) + 3} textAnchor="end" fontSize={10} fill="#7F8C8D">
              {tick}%
            </text>
          </g>
        ))}
        {grid.rows.map((row, ri) => {
          const color = CHART_COLORS[ri % CHART_COLORS.length];
          const points = row.cells
            .map((c, i) => `${xAt(i)},${yAt(pct(c))}`)
            .join(' ');
          return (
            <polyline
              key={row.roomTypeId}
              fill="none"
              stroke={color}
              strokeWidth={2}
              points={points}
            />
          );
        })}
        {grid.dates.map((d, i) =>
          i % Math.ceil(grid.dates.length / 8) === 0 || i === grid.dates.length - 1 ? (
            <text
              key={d}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#7F8C8D"
            >
              {d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-3 text-[12px] text-[#34495E]">
        {grid.rows.map((row, ri) => (
          <li key={row.roomTypeId} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CHART_COLORS[ri % CHART_COLORS.length] }}
            />
            {row.code}
          </li>
        ))}
      </ul>
    </section>
  );
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/occupancy?days=${days}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setGrid(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setLoading(false);
    }
  }, [days, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>;
  }

  return (
    <>
      <PageHeader title={t('occupancyTitle')} subtitle={t('occupancySubtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => router.push('/reports/occupancy?days=30')}
      >
        <FieldSelect
          label={t('periodDays')}
          preset="shortText"
          value={String(days)}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10) || 30;
            router.push(`/reports/occupancy?days=${n}`);
          }}
        >
          <option value="14">{t('days14')}</option>
          <option value="30">{t('days30')}</option>
        </FieldSelect>
      </EraListFilterBar>

      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('legend')}</p>
      {loading && <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>}

      {grid && !loading && (
        <>
          <OccupancyLineChart grid={grid} title={t('occupancyChartTitle')} />
          <section className={`${CARD_CONTAINER_CLASS} p-4 p-0`}>
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
          </section>
        </>
      )}
    </>
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
