'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  eventName: string;
  eventDate: string;
  saloon: string;
  pax: number;
  status: string;
  plannedRevenue: number;
  actualRevenue: number;
  variance: number;
  counterparty: string | null;
};

export default function EventProfitabilityPage() {
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/event-profitability');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    if (can(PERMISSIONS.REPORTS_READ)) void load();
  }, [can, load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.eventName} ${r.saloon} ${r.counterparty ?? ''}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('profitabilityTitle')}
        subtitle={t('profitabilitySubtitle')}
        actions={
          <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
            {tc('back')}
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
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2">{t('eventDate')}</th>
              <th className="py-2">{t('eventName')}</th>
              <th className="py-2">{t('saloon')}</th>
              <th className="py-2">{t('plannedRevenue')}</th>
              <th className="py-2">{t('actualRevenue')}</th>
              <th className="py-2">{t('variance')}</th>
              <th className="py-2">{t('counterparty')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{new Date(r.eventDate).toLocaleDateString()}</td>
                <td className="py-2">
                  <Link href={`/banquets/${r.id}`} className="text-[#3498DB] underline">
                    {r.eventName}
                  </Link>
                </td>
                <td className="py-2">{r.saloon}</td>
                <td className="py-2">{r.plannedRevenue}</td>
                <td className="py-2">{r.actualRevenue}</td>
                <td className="py-2">{r.variance}</td>
                <td className="py-2">{r.counterparty ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
