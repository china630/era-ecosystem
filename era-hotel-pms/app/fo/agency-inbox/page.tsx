'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from '@era/satellite-kit/ui';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type InboxRow = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  agency?: { code: string; name: string } | null;
  guest?: { fullName: string } | null;
  roomType?: { code: string; name: string } | null;
  salesContract?: { code: string } | null;
};

export default function AgencyInboxPage() {
  const { can } = useAuth();
  const t = useTranslations('agencyInbox');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [agency, setAgency] = useState('');
  const [roomType, setRoomType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fo/agency-inbox');
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
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  async function act(reservationId: string, action: 'confirm' | 'decline') {
    setBusy(true);
    try {
      const res = await fetch('/api/fo/agency-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(action === 'confirm' ? t('confirmed') : t('declined'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  const agencyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const code = row.agency?.code;
      if (!code) continue;
      seen.set(code, row.agency?.name || code);
    }
    return [...seen.entries()].map(([code, name]) => ({
      value: code,
      label: name === code ? code : `${code} — ${name}`,
    }));
  }, [rows]);

  const roomTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.roomType?.code) seen.add(row.roomType.code);
    }
    return [...seen].sort().map((code) => ({ value: code, label: code }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return rows.filter((row) => {
      if (agency && row.agency?.code !== agency) return false;
      if (roomType && row.roomType?.code !== roomType) return false;
      const start = hotelDateKey(row.checkInDate);
      const end = hotelDateKey(row.checkOutDate);
      if (dateFrom && end < dateFrom) return false;
      if (dateTo && start > dateTo) return false;
      if (!needle) return true;
      return `${row.guest?.fullName ?? ''} ${row.agency?.code ?? ''} ${row.agency?.name ?? ''} ${row.salesContract?.code ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, debouncedQ, agency, roomType, dateFrom, dateTo]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setAgency('');
          setRoomType('');
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
        <CatalogField
          kind="SEARCHABLE"
          label={t('roomType')}
          value={roomType}
          onChange={(v) => setRoomType(String(Array.isArray(v) ? (v[0] ?? '') : v))}
          options={roomTypeOptions}
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
      <HotelDataGrid<InboxRow & Record<string, unknown>>
        columns={[
          {
            key: 'agency',
            header: t('agency'),
            sortable: true,
            sortValue: (r) => r.agency?.code ?? '',
            render: (r) => r.agency?.code ?? '—',
          },
          {
            key: 'guest',
            header: t('guest'),
            sortable: true,
            sortValue: (r) => r.guest?.fullName ?? '',
            render: (r) => r.guest?.fullName ?? '—',
          },
          {
            key: 'roomType',
            header: t('roomType'),
            sortable: true,
            sortValue: (r) => r.roomType?.code ?? '',
            render: (r) => r.roomType?.code ?? '—',
          },
          {
            key: 'checkInDate',
            header: t('checkIn'),
            sortable: true,
            sortValue: (r) => String(r.checkInDate),
            render: (r) => String(r.checkInDate).slice(0, 10),
          },
          {
            key: 'checkOutDate',
            header: t('checkOut'),
            sortable: true,
            sortValue: (r) => String(r.checkOutDate),
            render: (r) => String(r.checkOutDate).slice(0, 10),
          },
          {
            key: 'contract',
            header: t('contract'),
            sortable: true,
            sortValue: (r) => r.salesContract?.code ?? '',
            render: (r) => r.salesContract?.code ?? '—',
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) =>
              can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, 'confirm')}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, 'decline')}
                  >
                    {t('decline')}
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (InboxRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
      />
    </>
  );
}
