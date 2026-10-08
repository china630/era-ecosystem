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
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function roomMoveReason(
  row: { reasonCode?: string | null; notes?: string | null },
  t: (key: string) => string,
): string {
  const raw = (row.reasonCode ?? '').trim();
  const note = (row.notes ?? '').trim();
  if (raw === 'CARD_ASSIGN' || note === 'CARD_ASSIGN') return t('reasonCard');
  if (raw === 'SWAP') return t('reasonSwap');
  if (raw === 'RELOCATE') return t('reasonRelocate');
  if (note) return note;
  return t('reasonOther');
}

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
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  function reasonKind(row: Row) {
    const raw = (row.reasonCode ?? '').trim();
    const note = (row.notes ?? '').trim();
    if (raw === 'CARD_ASSIGN' || note === 'CARD_ASSIGN') return 'CARD';
    if (raw === 'SWAP') return 'SWAP';
    if (raw === 'RELOCATE') return 'RELOCATE';
    return 'OTHER';
  }

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    const matched = rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (reason && reasonKind(r) !== reason) return false;
      const day = hotelDateKey(r.effectiveAt);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (!q) return true;
      return `${r.reservation.guest.fullName} ${r.fromRoom?.roomNumber ?? ''} ${r.toRoom?.roomNumber ?? ''} ${r.status}`
        .toLowerCase()
        .includes(q);
    });
    return [...matched].sort((a, b) => String(b.effectiveAt).localeCompare(String(a.effectiveAt)));
  }, [rows, debouncedQ, status, reason, dateFrom, dateTo]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setStatus('');
          setReason('');
          setDateFrom('');
          setDateTo('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('status')}
          value={status}
          onChange={(v) => setStatus(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={[
            { value: 'PENDING', label: t('statusPending') },
            { value: 'APPLIED', label: t('statusApplied') },
            { value: 'CANCELLED', label: t('statusCancelled') },
          ]}
          emptyLabel={tc('all')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('reason')}
          value={reason}
          onChange={(v) => setReason(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={[
            { value: 'CARD', label: t('reasonCard') },
            { value: 'SWAP', label: t('reasonSwap') },
            { value: 'RELOCATE', label: t('reasonRelocate') },
            { value: 'OTHER', label: t('reasonOther') },
          ]}
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
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          {
            key: 'guest',
            header: t('guest'),
            sortable: true,
            sortValue: (r) => r.reservation.guest.fullName,
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
          {
            key: 'from',
            header: t('from'),
            sortable: true,
            sortValue: (r) => r.fromRoom?.roomNumber ?? '',
            render: (r) => r.fromRoom?.roomNumber ?? '—',
          },
          {
            key: 'to',
            header: t('to'),
            sortable: true,
            sortValue: (r) => r.toRoom?.roomNumber ?? '',
            render: (r) => r.toRoom?.roomNumber ?? '—',
          },
          {
            key: 'when',
            header: t('effective'),
            sortable: true,
            sortValue: (r) => r.effectiveAt,
            render: (r) => bakuDateTimeDisplay(r.effectiveAt),
          },
          {
            key: 'reason',
            header: t('reason'),
            sortable: true,
            sortValue: (r) => roomMoveReason(r, t),
            render: (r) => roomMoveReason(r, t),
          },
          { key: 'status', header: t('status'), sortable: true },
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
