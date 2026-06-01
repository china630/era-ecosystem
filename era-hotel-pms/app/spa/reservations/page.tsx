'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell from '@/components/layout/AppShell';

type Row = {
  id: string;
  startAt: string;
  staffName: string | null;
  placeCode: string | null;
  service: { name: string };
  reservation: { guest: { fullName: string } };
};

export default function SpaReservationsPage() {
  const t = useTranslations('spaReservationList');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/procedures/appointments');
    const data = await res.json();
    if (Array.isArray(data)) setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/procedures" className="text-[#2980B9]">
          {t('openScheduler')}
        </Link>
      </p>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: 'Guest', render: (r) => r.reservation.guest.fullName },
          { key: 'service', header: 'Service', render: (r) => r.service.name },
          { key: 'start', header: 'Start', render: (r) => r.startAt.slice(0, 16) },
          { key: 'place', header: 'Place', render: (r) => r.placeCode ?? '—' },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    </AppShell>
  );
}
