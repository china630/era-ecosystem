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
  TEXT_MUTED_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuDateDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import GuestCardModal from '@/components/GuestCardModal';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { isDepartedPartyRow } from '@/lib/party-departed-stamp';

type InHouseGuest = {
  rowKey: string;
  reservationId: string;
  guestId: string | null;
  guestName: string;
  roomNumber: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
};

type StayPayload = {
  id: string;
  status: string;
  guest: { id: string; fullName: string };
  room: { roomNumber: string } | null;
  checkInDate?: string;
  checkOutDate?: string;
  paxGuests?: Array<{
    id: string;
    guestId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    departedAt?: string | null;
    guestState?: string | null;
    isPrimary?: boolean;
  }>;
};

function livePartyRows(stay: StayPayload): InHouseGuest[] {
  const checkInDate = String(stay.checkInDate ?? '').slice(0, 10);
  const checkOutDate = String(stay.checkOutDate ?? '').slice(0, 10);
  const roomNumber = stay.room?.roomNumber ?? null;
  const pax = stay.paxGuests ?? [];
  const live = pax.filter((row) => !isDepartedPartyRow(row));

  // Party rows exist but everyone departed → omit (not an occupied in-house line).
  if (pax.length > 0 && live.length === 0) {
    return [];
  }

  // Legacy stay with no pax rows → primary guest only.
  if (live.length === 0) {
    return [
      {
        rowKey: `${stay.id}:primary`,
        reservationId: stay.id,
        guestId: stay.guest.id,
        guestName: stay.guest.fullName,
        roomNumber,
        status: stay.status,
        checkInDate,
        checkOutDate,
      },
    ];
  }

  return live.map((row) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return {
      rowKey: `${stay.id}:${row.id}`,
      reservationId: stay.id,
      guestId: row.guestId?.trim() || null,
      guestName: name || stay.guest.fullName,
      roomNumber,
      status: stay.status,
      checkInDate,
      checkOutDate,
    };
  });
}

export default function InHousePage() {
  const { can } = useAuth();
  const t = useTranslations('inHousePage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InHouseGuest[]>([]);
  const [guestCardId, setGuestCardId] = useState<string | null>(null);
  const [folioReservationId, setFolioReservationId] = useState<string | null>(null);
  const [stayCardId, setStayCardId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [room, setRoom] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations?status=IN_HOUSE&includeParty=1');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      const list = (Array.isArray(data) ? data : []) as StayPayload[];
      setRows(list.flatMap((stay) => livePartyRows(stay)));
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
    const needle = debouncedQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (room && r.roomNumber !== room) return false;
      if (!needle) return true;
      return `${r.guestName} ${r.roomNumber ?? ''} ${r.status}`.toLowerCase().includes(needle);
    });
  }, [rows, debouncedQ, room]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tc('accessDenied')}</p>;
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
            render: (r) =>
              r.guestId ? (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => setGuestCardId(r.guestId)}
                >
                  {r.guestName}
                </button>
              ) : (
                <span>{r.guestName}</span>
              ),
          },
          { key: 'status', header: tc('status'), sortable: true, render: (r) => r.status },
          {
            key: 'arrival',
            header: t('arrival'),
            sortable: true,
            sortValue: (r) => r.checkInDate,
            render: (r) => (r.checkInDate ? bakuDateDisplay(r.checkInDate) : '—'),
          },
          {
            key: 'departure',
            header: t('departure'),
            sortable: true,
            sortValue: (r) => r.checkOutDate,
            render: (r) => (r.checkOutDate ? bakuDateDisplay(r.checkOutDate) : '—'),
          },
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
        rowKey={(r) => r.rowKey}
        onRowDoubleClick={(r) => setStayCardId(r.reservationId)}
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
      <ReservationCardModal
        open={Boolean(stayCardId)}
        reservationId={stayCardId}
        onClose={() => setStayCardId(null)}
      />
    </>
  );
}
