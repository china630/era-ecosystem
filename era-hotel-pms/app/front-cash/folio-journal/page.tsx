'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  time: string;
  folioId: string;
  reservationId: string | null;
  guestName: string | null;
  roomNumber: string | null;
  department: string | null;
  charge: number;
  payment: number;
  balance: number;
  description: string;
};

function todayIso() {
  return hotelDateKey();
}

export default function FolioJournalPage() {
  const { can } = useAuth();
  const t = useTranslations('folioJournal');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [rows, setRows] = useState<Row[]>([]);
  const [folioReservationId, setFolioReservationId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [entry, setEntry] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/front-cash/folio-journal?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const departmentOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.department) seen.add(row.department);
    }
    return [...seen].sort().map((name) => ({ value: name, label: name }));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return rows.filter((row) => {
      if (department && row.department !== department) return false;
      if (entry === 'charge' && Number(row.charge) === 0) return false;
      if (entry === 'payment' && Number(row.payment) === 0) return false;
      if (!needle) return true;
      return `${row.guestName ?? ''} ${row.roomNumber ?? ''} ${row.description} ${row.department ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, debouncedQ, department, entry]);

  if (!can(PERMISSIONS.FOLIO_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', {
          charges: visible.reduce((sum, row) => sum + Number(row.charge || 0), 0).toFixed(2),
          payments: visible.reduce((sum, row) => sum + Number(row.payment || 0), 0).toFixed(2),
        })}
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
          setQ('');
          setDepartment('');
          setEntry('');
        }}
      >
        <Field label={tc('search')} preset="longText" value={q} onChange={(e) => setQ(e.target.value)} />
        <CatalogField
          kind="SEARCHABLE"
          label={t('colDept')}
          value={department}
          onChange={(v) => setDepartment(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={departmentOptions}
          emptyLabel={tc('all')}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('kind')}
          value={entry}
          onChange={(v) => setEntry(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={[
            { value: 'charge', label: t('colCharge') },
            { value: 'payment', label: t('colPayment') },
          ]}
          emptyLabel={tc('all')}
        />
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          {
            key: 'time',
            header: t('colTime'),
            sortable: true,
            sortValue: (r) => r.time,
            render: (r) => bakuDateTimeDisplay(r.time),
          },
          { key: 'guestName', header: t('colGuest'), sortable: true, render: (r) => r.guestName ?? '—' },
          { key: 'roomNumber', header: t('colRoom'), sortable: true, render: (r) => r.roomNumber ?? '—' },
          { key: 'department', header: t('colDept'), sortable: true, render: (r) => r.department ?? '—' },
          { key: 'description', header: t('colDesc'), sortable: true },
          { key: 'charge', header: t('colCharge'), sortable: true, sortValue: (r) => r.charge, render: (r) => r.charge.toFixed(2) },
          { key: 'payment', header: t('colPayment'), sortable: true, sortValue: (r) => r.payment, render: (r) => r.payment.toFixed(2) },
          { key: 'balance', header: t('colBalance'), sortable: true, sortValue: (r) => r.balance, render: (r) => r.balance.toFixed(2) },
          {
            key: 'open',
            header: tc('actions'),
            render: (r) =>
              r.reservationId ? (
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
        rows={visible as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={t('empty')}
      />
      <ReservationCardModal
        open={Boolean(folioReservationId)}
        reservationId={folioReservationId}
        initialTab="folio"
        onClose={() => {
          setFolioReservationId(null);
          void load();
        }}
      />
    </>
  );
}
