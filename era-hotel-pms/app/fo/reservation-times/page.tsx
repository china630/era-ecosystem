'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  guest: { fullName: string };
  checkInDate: string;
  checkOutDate: string;
  stay: { actualCheckIn: string; actualCheckOut: string | null } | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export default function ReservationTimesPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationTimes');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(() => plusDaysIso(7));
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/reservation-times?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const f = todayIso();
          const t0 = plusDaysIso(7);
          setFrom(f);
          setTo(t0);
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
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'plannedIn', header: t('plannedIn'), render: (r) => r.checkInDate.slice(0, 10) },
          { key: 'plannedOut', header: t('plannedOut'), render: (r) => r.checkOutDate.slice(0, 10) },
          { key: 'actualIn', header: t('actualIn'), render: (r) => r.stay?.actualCheckIn?.slice(0, 16) ?? '—' },
          { key: 'actualOut', header: t('actualOut'), render: (r) => r.stay?.actualCheckOut?.slice(0, 16) ?? '—' },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
