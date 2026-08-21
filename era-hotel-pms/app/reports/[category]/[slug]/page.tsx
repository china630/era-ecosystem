'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getReportBySlug, type ReportDef } from '@/lib/reports/catalog';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';

interface ReportData {
  rows?: Record<string, unknown>[];
  [key: string]: unknown;
}

export default function ReportSlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const t = useTranslations();

  const [businessDate, setBusinessDate] = useState<string>('');
  const [filters, setFilters] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def: ReportDef | undefined = getReportBySlug(slug);

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
        const qs = new URLSearchParams({ from, to });
        const res = await fetch(`/api/reports/${encodeURIComponent(slug)}?${qs}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (filters) fetchData(filters.from, filters.to);
  }, [fetchData, filters]);

  if (!def) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-red-600">Unknown report: {slug}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t(def.titleKey as 'reportsPdf.trialBalancePeriod')}</h1>

      {businessDate && (
        <ReportFilterBar
          slug={slug}
          dateMode={def.dateMode}
          businessDate={businessDate}
          onChange={setFilters}
        />
      )}

      {loading && <p className="text-gray-500">{t('common.loading')}</p>}
      {error && <p className="text-red-600">{error}</p>}

      {data && <ReportDataTable slug={slug} data={data} />}
    </div>
  );
}

function ReportDataTable({ slug, data }: { slug: string; data: ReportData }) {
  const rows: Record<string, unknown>[] = (data.rows as Record<string, unknown>[]) ?? [];

  if (rows.length === 0) {
    return <p className="text-gray-500">No data for selected period.</p>;
  }

  const columns = Object.keys(rows[0]).filter((k) => k !== 'id');

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-medium text-gray-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50' : undefined}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-1.5 text-gray-800">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return v % 1 === 0 ? String(v) : v.toFixed(2);
  return String(v);
}
