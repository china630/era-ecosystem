'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface TabDef {
  key: string;
  slug: string;
  labelKey: string;
}

const TABS: TabDef[] = [
  { key: 'list', slug: 'daily-management', labelKey: 'reportsPdf.dailyManagement' },
  { key: 'summary', slug: 'daily-management-summary', labelKey: 'reportsPdf.dailyManagementSummary' },
  { key: 'revenue', slug: 'department-revenues', labelKey: 'reportsPdf.departmentRevenues' },
  { key: 'yoy', slug: 'room-type-yoy', labelKey: 'reportsPdf.roomTypeYoy' },
  { key: 'forecast', slug: 'forecast', labelKey: 'reportsPdf.forecast' },
];

export default function DailyManagementPage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('list');
  const [businessDate, setBusinessDate] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/business-date')
      .then((r) => r.json())
      .then((d) => setBusinessDate(d.date ?? new Date().toISOString().slice(0, 10)))
      .catch(() => setBusinessDate(new Date().toISOString().slice(0, 10)));
  }, []);

  const tab = TABS.find((t) => t.key === activeTab)!;

  const fetchReport = useCallback(async () => {
    if (!businessDate) return;
    setLoading(true);
    setData(null);
    try {
      const from = businessDate;
      const to = businessDate;
      const res = await fetch(`/api/reports/${tab.slug}?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessDate, tab.slug]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{t('reportsPdf.dailyManagement')}</h1>

      <div className="flex items-center gap-4">
        <input
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setActiveTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tb.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {loading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}
        {!loading && !data && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
        {!loading && data && (
          <pre className="text-xs bg-gray-50 rounded p-4 overflow-auto max-h-[70vh]">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
