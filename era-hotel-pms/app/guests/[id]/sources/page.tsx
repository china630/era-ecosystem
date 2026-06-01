'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

export default function GuestSourcesPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('guestCard');
  const tc = useTranslations('common');
  const [sources, setSources] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guests/${id}/reservation-analytics`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setSources(Array.isArray(data.sources) ? data.sources : []);
  }, [id, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell maxWidthClass="max-w-[800px]">
      <PageHeader
        title={t('crmPages.sourcesTitle')}
        actions={<Link href="/guests" className="text-[13px] text-[#2980B9]">{t('crmPages.backToGuests')}</Link>}
      />
      <StatusMessage>{msg}</StatusMessage>
      <ul className="space-y-2 text-[13px]">
        {sources.map((s) => (
          <li key={String(s.resSource)} className="rounded-lg border border-[#D5DADF] p-3">
            {String(s.sourceName)} — {String(s.roomCount)} stays, {Number(s.totalRevenue).toFixed(2)}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
