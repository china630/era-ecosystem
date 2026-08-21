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
import GuestCardModal from '@/components/GuestCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type InHouseGuest = {
  reservationId: string;
  guestId: string;
  guestName: string;
  roomNumber: string | null;
  status: string;
};

export default function InHousePage() {
  const { can } = useAuth();
  const t = useTranslations('inHousePage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InHouseGuest[]>([]);
  const [guestCardId, setGuestCardId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations?status=IN_HOUSE');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setRows(
        list.map(
          (r: {
            id: string;
            status: string;
            guest: { id: string; fullName: string };
            room: { roomNumber: string } | null;
          }) => ({
            reservationId: r.id,
            guestId: r.guest.id,
            guestName: r.guest.fullName,
            roomNumber: r.room?.roomNumber ?? null,
            status: r.status,
          }),
        ),
      );
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
      `${r.guestName} ${r.roomNumber ?? ''} ${r.status}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader title={t('title')} />
        <Link
          href="/reports/daily/in-house"
          className="rounded bg-[#ECF0F1] px-2 py-1 text-[12px] text-[#2980B9] hover:bg-[#D5DBDB]"
        >
          PDF Report
        </Link>
      </div>
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
      <HotelDataGrid<InHouseGuest & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.roomNumber ?? '—' },
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setGuestCardId(r.guestId)}
              >
                {r.guestName}
              </button>
            ),
          },
          { key: 'status', header: tc('status'), render: (r) => r.status },
          {
            key: 'folio',
            header: t('folio'),
            render: (r) =>
              can(PERMISSIONS.FOLIO_READ) ? (
                <Link
                  href={`/folio/${r.reservationId}`}
                  className="text-[#2980B9] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('openFolio')}
                </Link>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (InHouseGuest & Record<string, unknown>)[]}
        rowKey={(r) => r.reservationId}
        emptyMessage={t('empty')}
      />
      <GuestCardModal
        open={Boolean(guestCardId)}
        guestId={guestCardId}
        onClose={() => setGuestCardId(null)}
      />
    </>
  );
}
