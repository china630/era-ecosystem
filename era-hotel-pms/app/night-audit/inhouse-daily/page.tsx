'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  room: { roomNumber: string } | null;
  roomType: { code: string };
  checkInDate: string;
  checkOutDate: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InhouseDailyPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('inhouseDaily');
  const tc = useTranslations('common');
  const [date, setDate] = useState(todayIso);
  const [inHouse, setInHouse] = useState<Row[]>([]);
  const [departures, setDepartures] = useState<Row[]>([]);

  useEffect(() => {
    const d = searchParams.get('date');
    if (d) setDate(d);
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/inhouse-daily?date=${date}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setInHouse(data.inHouse ?? []);
      setDepartures(data.departures ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [date, tc]);

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
        onReset={() => setDate(todayIso())}
      >
        <DatePicker
          label={tc('date')}
          value={date}
          onChange={setDate}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <h2 className="mb-2 text-[14px] font-semibold">{t('inHouse')}</h2>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'type', header: t('type'), render: (r) => r.roomType.code },
          { key: 'checkOut', header: t('departure'), render: (r) => r.checkOutDate.slice(0, 10) },
        ]}
        rows={inHouse}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">{t('departuresToday')}</h2>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
        ]}
        rows={departures}
        rowKey={(r) => `d-${r.id}`}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
