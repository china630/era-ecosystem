'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import ExecutiveCockpit, { type CockpitData } from '@/components/ExecutiveCockpit';

export default function ExecutiveDashboard() {
  const t = useTranslations('executiveDashboard');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/executive/dashboard?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? tc('loadError'));
      setData(json as CockpitData);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('loadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#34495E]">{t('title')}</h1>
          <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[#D5DADF] px-3 py-2 text-[13px]"
          />
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('load')}
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-[13px] text-red-600">{error}</p> : null}
      {loading ? <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p> : null}
      {data ? <ExecutiveCockpit data={data} /> : null}
    </div>
  );
}
