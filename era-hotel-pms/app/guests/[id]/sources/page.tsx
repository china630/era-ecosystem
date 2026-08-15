'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  CARD_CONTAINER_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

export default function GuestSourcesPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [sources, setSources] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/guests/${id}/reservation-analytics`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) =>
      `${s.sourceName} ${s.resSource}`.toLowerCase().includes(q),
    );
  }, [sources, debouncedQ]);

  return (
    <>
      <PageHeader
        title={t('crmPages.sourcesTitle')}
        leading={
          <Link href="/guests" className="text-[13px] text-[#2980B9] hover:underline">
            {t('crmPages.backToGuests')}
          </Link>
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setQ('')}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{t('crmPages.empty')}</p>
      ) : (
        <ul className={`${CARD_CONTAINER_CLASS} space-y-2 p-3 text-[13px]`}>
          {filtered.map((s) => (
            <li key={String(s.resSource)} className="rounded-lg border border-[#D5DADF] p-3">
              {String(s.sourceName)} — {String(s.roomCount)} stays, {Number(s.totalRevenue).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
