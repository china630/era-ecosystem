'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function NightlyPackPage() {
  const t = useTranslations();
  const [date, setDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!date) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/nightly-pack?date=${date}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nightly-pack-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t('reports.nightlyPack')}</h1>
      <div className="flex items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('reports.selectDate')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!date || downloading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {t('reports.downloadZip')}
        </button>
      </div>
    </div>
  );
}
