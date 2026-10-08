'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import GroupBookingModal from '@/components/GroupBookingModal';
import ReservationCardModal from '@/components/ReservationCardModal';

type GroupRow = {
  id: string;
  code: string;
  name: string | null;
  groupBalance?: number;
  checkInDate?: string;
  checkOutDate?: string;
  agency: { code: string; name: string } | null;
  reservations: Array<{
    id: string;
    checkInDate?: string;
    checkOutDate?: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
  }>;
};

export default function GroupReservationsPage() {
  const { can } = useAuth();
  const t = useTranslations('groupReservations');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [agency, setAgency] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservation-groups');
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

  const agencyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!row.agency?.code) continue;
      seen.set(row.agency.code, row.agency.name || row.agency.code);
    }
    return [...seen.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, name]) => ({ value: code, label: name === code ? code : `${code} — ${name}` }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (agency && r.agency?.code !== agency) return false;
      const stayStarts = r.reservations.map((stay) => (stay.checkInDate ? hotelDateKey(stay.checkInDate) : '')).filter(Boolean);
      const stayEnds = r.reservations.map((stay) => (stay.checkOutDate ? hotelDateKey(stay.checkOutDate) : '')).filter(Boolean);
      const start = (r.checkInDate ? hotelDateKey(r.checkInDate) : '') || stayStarts.sort()[0] || '';
      const end = (r.checkOutDate ? hotelDateKey(r.checkOutDate) : '') || stayEnds.sort().at(-1) || start;
      if ((dateFrom || dateTo) && !start) return false;
      if (dateFrom && end < dateFrom) return false;
      if (dateTo && start > dateTo) return false;
      if (!q) return true;
      const guests = r.reservations.map((stay) => `${stay.guest.fullName} ${stay.room?.roomNumber ?? ''}`).join(' ');
      return `${r.code} ${r.name ?? ''} ${r.agency?.code ?? ''} ${r.agency?.name ?? ''} ${guests}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, debouncedQ, agency, dateFrom, dateTo]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.RESERVATIONS_WRITE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              + {tn('groupBooking')}
            </button>
          ) : undefined
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setAgency('');
          setDateFrom('');
          setDateTo('');
        }}
      >
        <Field label={tc('search')} preset="longText" value={q} onChange={(e) => setQ(e.target.value)} />
        <CatalogField
          kind="SEARCHABLE"
          label={t('agency')}
          value={agency}
          onChange={(v) => setAgency(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={agencyOptions}
          emptyLabel={tc('all')}
        />
        <DatePicker
          label={tc('from')}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={dateTo}
          onChange={setDateTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <HotelDataGrid<GroupRow & Record<string, unknown>>
        columns={[
          {
            key: 'code',
            header: t('code'),
            sortable: true,
            render: (r) => (
              <button
                type="button"
                className="text-left font-mono text-[12px] text-[#2980B9] hover:underline"
                title={t('openBooking')}
                onClick={() => {
                  const first = r.reservations[0];
                  if (first) setCardId(first.id);
                }}
              >
                {r.code}
              </button>
            ),
          },
          { key: 'name', header: t('name'), sortable: true, render: (r) => r.name ?? '—' },
          {
            key: 'agency',
            header: t('agency'),
            sortable: true,
            sortValue: (r) => r.agency?.code ?? '',
            render: (r) => r.agency?.code ?? '—',
          },
          {
            key: 'rooms',
            header: t('rooms'),
            sortable: true,
            sortValue: (r) => r.reservations.length,
            render: (r) => String(r.reservations.length),
          },
          {
            key: 'balance',
            header: t('balance'),
            sortable: true,
            sortValue: (r) => r.groupBalance ?? 0,
            render: (r) => (r.groupBalance != null ? r.groupBalance.toFixed(2) : '—'),
          },
          {
            key: 'guests',
            header: t('guests'),
            sortable: true,
            sortValue: (r) => r.reservations[0]?.guest.fullName ?? '',
            render: (r) =>
              r.reservations.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {r.reservations.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className="text-left font-mono text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setCardId(x.id)}
                    >
                      {x.guest.fullName}
                      {x.room ? ` · ${x.room.roomNumber}` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (GroupRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <GroupBookingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={({ firstStayId }) => {
          void load();
          if (firstStayId) setCardId(firstStayId);
        }}
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
