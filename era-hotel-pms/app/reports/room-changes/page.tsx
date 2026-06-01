'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  effectiveAt: string;
  reservation: { guest: { fullName: string } };
  fromRoom: { roomNumber: string } | null;
  toRoom: { roomNumber: string } | null;
};

export default function RoomChangesPage() {
  const { can } = useAuth();
  const t = useTranslations('roomChanges');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/reports/room-changes');
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [tc]);

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
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: t('guest'), render: (r) => r.reservation.guest.fullName },
          { key: 'from', header: t('from'), render: (r) => r.fromRoom?.roomNumber ?? '—' },
          { key: 'to', header: t('to'), render: (r) => r.toRoom?.roomNumber ?? '—' },
          { key: 'when', header: t('effective'), render: (r) => r.effectiveAt.slice(0, 16) },
          { key: 'status', header: t('status') },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    </AppShell>
  );
}
