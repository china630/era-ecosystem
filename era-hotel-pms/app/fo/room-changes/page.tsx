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
import { HotelDataGrid } from '@/components/HotelDataGrid';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  effectiveAt: string;
  notes?: string | null;
  reasonCode?: string | null;
  reservation: { id: string; guest: { fullName: string } };
  fromRoom: { roomNumber: string } | null;
  toRoom: { roomNumber: string } | null;
};

export default function RoomChangesPage() {
  const { can } = useAuth();
  const t = useTranslations('roomChanges');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [cardId, setCardId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/room-changes');
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
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.reservation.guest.fullName} ${r.fromRoom?.roomNumber ?? ''} ${r.toRoom?.roomNumber ?? ''} ${r.status}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, debouncedQ]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-2 max-w-3xl text-sm text-[#7F8C8D]">{t('howToChange')}</p>
      <p className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/fo/room-plan" className="text-[#2980B9] hover:underline">
          {t('openPlan')}
        </Link>
        <Link href="/fo/rack" className="text-[#2980B9] hover:underline">
          {t('openRack')}
        </Link>
      </p>
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setQ('')}>
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setCardId(r.reservation.id)}
              >
                {r.reservation.guest.fullName}
              </button>
            ),
          },
          { key: 'from', header: t('from'), render: (r) => r.fromRoom?.roomNumber ?? '—' },
          { key: 'to', header: t('to'), render: (r) => r.toRoom?.roomNumber ?? '—' },
          {
            key: 'when',
            header: t('effective'),
            render: (r) => r.effectiveAt.slice(0, 16).replace('T', ' '),
          },
          { key: 'reason', header: t('reason'), render: (r) => r.reasonCode ?? r.notes ?? '—' },
          { key: 'status', header: t('status') },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <ReservationCardModal
        open={Boolean(cardId)}
        reservationId={cardId}
        onClose={() => {
          setCardId(null);
          void load();
        }}
      />
    </>
  );
}
