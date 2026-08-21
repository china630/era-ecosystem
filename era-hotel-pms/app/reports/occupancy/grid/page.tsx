'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraListFilterBar, DatePicker, PageHeader } from '@era/satellite-kit/ui';

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

export default function OccupancyGridPage() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(14);
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({ from, days: String(days) });
    const res = await fetch(`/api/reports/occupancy?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? tc('loadError'));
      setGrid(null);
      return;
    }
    setGrid(body);
  }, [days, from, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <PageHeader title={t('occupancyTitle')} subtitle={t('occupancySubtitle')} />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setDays(14)}>
        <DatePicker
          label={t('dateFrom')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
        />
      </EraListFilterBar>
      <div className="flex gap-2">
        {[14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              days === d ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {d === 14 ? t('days14') : t('days30')}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {grid && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left">{t('type')}</th>
                {grid.dates.map((d) => (
                  <th key={d} className="px-1 py-2 text-center">
                    {d.slice(5)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">{t('avgPct')}</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.roomTypeId} className="border-t">
                  <td className="px-2 py-1 font-medium">
                    {row.code} · {row.name}
                  </td>
                  {row.cells.map((cell) => {
                    const free = cell.available - cell.sold;
                    const cls =
                      free >= 3 ? 'bg-green-50' : free >= 0 ? 'bg-amber-50' : 'bg-red-50';
                    return (
                      <td key={cell.date} className={`px-1 py-1 text-center ${cls}`}>
                        {cell.sold}/{cell.total}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right">{row.avgOccupancyPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">{t('legend')}</p>
    </div>
  );
}
