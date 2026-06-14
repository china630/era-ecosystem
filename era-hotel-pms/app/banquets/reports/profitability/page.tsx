'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@era/satellite-kit/ui';
import { SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
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

  const load = useCallback(async () => {
    const res = await fetch('/api/reports/event-profitability');
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (can(PERMISSIONS.REPORTS_READ)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={t('profitabilityTitle')}
        subtitle={t('profitabilitySubtitle')}
        actions={
          <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
            {tc('back')}
          </Link>
        }
      />
      <PageSection>
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
            {rows.map((r) => (
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
      </PageSection>
    </AppShell>
  );
}
