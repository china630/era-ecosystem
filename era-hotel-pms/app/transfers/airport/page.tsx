'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
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
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/transfers/orders');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (Array.isArray(data)) {
        setRows(data.filter((o: Row) => o.flightNo != null && o.flightNo.trim() !== ''));
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.reservation.guest.fullName} ${r.flightNo ?? ''} ${r.status}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/transfers" className="text-[#2980B9]">
          {t('allTransfers')}
        </Link>
      </p>
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
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: tc('guest'), render: (r) => r.reservation.guest.fullName },
          { key: 'flight', header: 'Flight', render: (r) => r.flightNo ?? '—' },
          { key: 'pickup', header: 'Pickup', render: (r) => r.pickupAt.slice(0, 16) },
          { key: 'status', header: tc('status') },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
