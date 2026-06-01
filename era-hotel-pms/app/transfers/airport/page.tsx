'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell from '@/components/layout/AppShell';
import Link from 'next/link';

type Row = {
  id: string;
  pickupAt: string;
  flightNo: string | null;
  status: string;
  reservation: { guest: { fullName: string } };
  vehicle: { code: string } | null;
};

export default function AirportTransferPage() {
  const t = useTranslations('airportTransfer');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/transfers/orders');
    const data = await res.json();
    if (Array.isArray(data)) {
      setRows(data.filter((o: Row) => o.flightNo != null && o.flightNo.trim() !== ''));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/transfers" className="text-[#2980B9]">
          {t('allTransfers')}
        </Link>
      </p>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: 'Guest', render: (r) => r.reservation.guest.fullName },
          { key: 'flight', header: 'Flight', render: (r) => r.flightNo ?? '—' },
          { key: 'pickup', header: 'Pickup', render: (r) => r.pickupAt.slice(0, 16) },
          { key: 'status', header: 'Status' },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    </AppShell>
  );
}
