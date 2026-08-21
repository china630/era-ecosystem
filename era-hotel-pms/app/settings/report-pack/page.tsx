'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getPackEligibleReports } from '@/lib/reports/catalog';

export default function ReportPackSettingsPage() {
  const t = useTranslations();
  const eligible = getPackEligibleReports();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/report-pack')
      .then((r) => r.json())
      .then((data: { reportIds: string[] }) => setSelected(new Set(data.reportIds)))
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/admin/report-pack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: [...selected] }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t('reports.nightlyPack')}</h1>
      <div className="space-y-3">
        {eligible.map((r) => (
          <label key={r.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">{t(r.titleKey as 'reports.analyticsTitle')}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
    </div>
  );
}
