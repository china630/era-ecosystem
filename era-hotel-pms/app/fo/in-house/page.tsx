'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import GuestCardModal from '@/components/GuestCardModal';
import ReservationCardModal from '@/components/ReservationCardModal';
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
  const [folioReservationId, setFolioReservationId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [room, setRoom] = useState('');
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

  const roomOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.roomNumber) seen.add(row.roomNumber);
    }
    return [...seen]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((number) => ({ value: number, label: number }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (room && r.roomNumber !== room) return false;
      if (!q) return true;
      return `${r.guestName} ${r.roomNumber ?? ''} ${r.status}`.toLowerCase().includes(q);
    });
  }, [rows, debouncedQ, room]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader title={t('title')} />
        <Link
          href="/reports?report=in-house"
          className="rounded bg-[#ECF0F1] px-2 py-1 text-[12px] text-[#2980B9] hover:bg-[#D5DBDB]"
        >
          PDF Report
        </Link>
      </div>
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setRoom('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t('room')}
          value={room}
          onChange={(v) => setRoom(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={roomOptions}
          emptyLabel={tc('all')}
        />
      </EraListFilterBar>
      <HotelDataGrid<InHouseGuest & Record<string, unknown>>
        columns={[
          {
            key: 'room',
            header: t('room'),
            sortable: true,
            sortValue: (r) => r.roomNumber ?? '',
            render: (r) => r.roomNumber ?? '—',
          },
          {
            key: 'guest',
            header: t('guest'),
            sortable: true,
            sortValue: (r) => r.guestName,
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
          { key: 'status', header: tc('status'), sortable: true, render: (r) => r.status },
          {
            key: 'folio',
            header: t('folio'),
            render: (r) =>
              can(PERMISSIONS.FOLIO_READ) ? (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => setFolioReservationId(r.reservationId)}
                >
                  {t('openFolio')}
                </button>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (InHouseGuest & Record<string, unknown>)[]}
        rowKey={(r) => r.reservationId}
        defaultSort={{ key: 'room', dir: 'asc' }}
        emptyMessage={t('empty')}
      />
      <GuestCardModal
        open={Boolean(guestCardId)}
        guestId={guestCardId}
        onClose={() => setGuestCardId(null)}
      />
      <ReservationCardModal
        open={Boolean(folioReservationId)}
        reservationId={folioReservationId}
        initialTab="folio"
        onClose={() => setFolioReservationId(null)}
      />
    </>
  );
}
