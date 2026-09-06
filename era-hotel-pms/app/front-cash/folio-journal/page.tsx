'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DatePicker, EraListFilterBar, PageHeader, showApiError } from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
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
  return new Date().toISOString().slice(0, 10);
}

export default function FolioJournalPage() {
  const { can } = useAuth();
  const t = useTranslations('folioJournal');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ charges: 0, payments: 0 });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/front-cash/folio-journal?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotals({
        charges: Number(data.totalCharges ?? 0),
        payments: Number(data.totalPayments ?? 0),
      });
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.FOLIO_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', {
          charges: totals.charges.toFixed(2),
          payments: totals.payments.toFixed(2),
        })}
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const d = todayIso();
          setFrom(d);
          setTo(d);
        }}
      >
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
            render: (r) => new Date(r.time).toLocaleString(),
          },
          { key: 'guestName', header: t('colGuest'), render: (r) => r.guestName ?? '—' },
          { key: 'roomNumber', header: t('colRoom'), render: (r) => r.roomNumber ?? '—' },
          { key: 'department', header: t('colDept'), render: (r) => r.department ?? '—' },
          { key: 'description', header: t('colDesc') },
          { key: 'charge', header: t('colCharge'), render: (r) => r.charge.toFixed(2) },
          { key: 'payment', header: t('colPayment'), render: (r) => r.payment.toFixed(2) },
          { key: 'balance', header: t('colBalance'), render: (r) => r.balance.toFixed(2) },
          {
            key: 'open',
            header: tc('actions'),
            render: (r) =>
              r.reservationId ? (
                <Link href={`/folio/${r.reservationId}`} className="text-[#2980B9] hover:underline">
                  {t('openFolio')}
                </Link>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={t('empty')}
      />
    </>
  );
}
