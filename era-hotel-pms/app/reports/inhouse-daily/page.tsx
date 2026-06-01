'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
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

export default function InhouseDailyPage() {
  const { can } = useAuth();
  const t = useTranslations('inhouseDaily');
  const tc = useTranslations('common');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inHouse, setInHouse] = useState<Row[]>([]);
  const [departures, setDepartures] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/inhouse-daily?date=${date}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setInHouse(data.inHouse ?? []);
    setDepartures(data.departures ?? []);
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader title={t('title')} />
      <div className="mb-4 flex gap-2">
        <input type="date" className="rounded border px-2 py-1 text-[13px]" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <StatusMessage>{msg}</StatusMessage>
      <h2 className="mb-2 text-[14px] font-semibold">{t('inHouse')}</h2>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'type', header: t('type'), render: (r) => r.roomType.code },
          { key: 'checkOut', header: t('departure'), render: (r) => r.checkOutDate.slice(0, 10) },
        ]}
        rows={inHouse}
        rowKey={(r) => r.id}
      />
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">{t('departuresToday')}</h2>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
        ]}
        rows={departures}
        rowKey={(r) => `d-${r.id}`}
      />
    </AppShell>
  );
}
