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
  checkInDate: string;
  checkOutDate: string;
  stay: { actualCheckIn: string; actualCheckOut: string | null } | null;
};

export default function ReservationTimesPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationTimes');
  const tc = useTranslations('common');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/reservation-times?from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [from, to, tc]);

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
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1 text-[13px]" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1 text-[13px]" />
      </div>
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'plannedIn', header: t('plannedIn'), render: (r) => r.checkInDate.slice(0, 10) },
          { key: 'plannedOut', header: t('plannedOut'), render: (r) => r.checkOutDate.slice(0, 10) },
          { key: 'actualIn', header: t('actualIn'), render: (r) => r.stay?.actualCheckIn?.slice(0, 16) ?? '—' },
          { key: 'actualOut', header: t('actualOut'), render: (r) => r.stay?.actualCheckOut?.slice(0, 16) ?? '—' },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    </AppShell>
  );
}
