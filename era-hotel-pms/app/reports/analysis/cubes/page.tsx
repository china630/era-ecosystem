'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';

const CUBES = ['revenue-cube', 'folio-cube', 'reservation-cube', 'agency-sales-cube'] as const;
const DIMS = ['date', 'department', 'agency', 'revenueCode', 'roomType'] as const;

export default function ReportCubesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-500">…</p>}>
      <ReportCubesInner />
    </Suspense>
  );
}

function ReportCubesInner() {
  const t = useTranslations();
  const locale = useLocale();
  const search = useSearchParams();
  const initial = search.get('cube') ?? 'revenue-cube';
  const [cube, setCube] = useState(CUBES.includes(initial as (typeof CUBES)[number]) ? initial : 'revenue-cube');
  const [dim, setDim] = useState('department');
  const [businessDate, setBusinessDate] = useState('');
  const [filters, setFilters] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<{ rows?: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/business-date')
      .then((r) => r.json())
      .then((d) => {
        const bd = d.businessDate ?? d.date ?? new Date().toISOString().slice(0, 10);
        setBusinessDate(typeof bd === 'string' ? bd.slice(0, 10) : bd);
      })
      .catch(() => setBusinessDate(new Date().toISOString().slice(0, 10)));
  }, []);

  const fetchData = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ from, to, lang: locale, dim });
        const res = await fetch(`/api/reports/${encodeURIComponent(cube)}?${qs}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cube');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [cube, dim, locale],
  );

  useEffect(() => {
    if (filters) void fetchData(filters.from, filters.to);
  }, [fetchData, filters]);

  const pdfHref = useMemo(() => {
    if (!filters) return '#';
    const qs = new URLSearchParams({ from: filters.from, to: filters.to, lang: locale, dim });
    return `/api/reports/${encodeURIComponent(cube)}/pdf?${qs}`;
  }, [cube, dim, filters, locale]);

  const rows = data?.rows ?? [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('reports.cubesTitle')}</h1>
      <p className="text-sm text-gray-600">{t('reports.cubesHint')}</p>
      <div className="flex flex-wrap gap-2">
        {CUBES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCube(id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              cube === id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white'
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {DIMS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setDim(id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              dim === id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white'
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      {businessDate && (
        <ReportFilterBar
          slug={cube}
          dateMode="range"
          businessDate={businessDate}
          onChange={setFilters}
        />
      )}
      {filters && (
        <a href={pdfHref} className="inline-block rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          {t('reports.exportPdf')}
        </a>
      )}
      {loading && <p className="text-gray-500">{t('common.loading')}</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && rows.length === 0 && <p className="text-gray-500">{t('reportsPdf.noData')}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-1.5">
                      {String(row[c] ?? '')}
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
