'use client';

import Link from 'next/link';
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
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/procedures/appointments');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (Array.isArray(data)) setRows(data);
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
      `${r.reservation.guest.fullName} ${r.service.name} ${r.placeCode ?? ''} ${r.staffName ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, debouncedQ]);

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/procedures" className="text-[#2980B9]">
          {t('openScheduler')}
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
          { key: 'service', header: 'Service', render: (r) => r.service.name },
          { key: 'start', header: 'Start', render: (r) => r.startAt.slice(0, 16) },
          { key: 'place', header: 'Place', render: (r) => r.placeCode ?? '—' },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
