'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type GroupRow = {
  id: string;
  code: string;
  name: string | null;
  groupBalance?: number;
  agency: { code: string; name: string } | null;
  reservations: Array<{
    id: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
  }>;
};

export default function GroupReservationsPage() {
  const { can } = useAuth();
  const t = useTranslations('groupReservations');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/reservation-groups');
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

  async function addGroup() {
    const code = window.prompt('Group code');
    if (!code?.trim()) return;
    const res = await fetch('/api/reservation-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('failed'));
      return;
    }
    await load();
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.RESERVATIONS_WRITE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void addGroup()}>
              {t('add')}
            </button>
          ) : undefined
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<GroupRow & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code'), render: (r) => r.code },
          { key: 'name', header: t('name'), render: (r) => r.name ?? '—' },
          {
            key: 'agency',
            header: 'Agency',
            render: (r) => r.agency?.code ?? '—',
          },
          {
            key: 'rooms',
            header: t('rooms'),
            render: (r) => String(r.reservations.length),
          },
          {
            key: 'balance',
            header: t('balance'),
            render: (r) => (r.groupBalance != null ? r.groupBalance.toFixed(2) : '—'),
          },
          {
            key: 'guests',
            header: t('guests'),
            render: (r) =>
              r.reservations
                .map((x) => `${x.guest.fullName}${x.room ? ` (${x.room.roomNumber})` : ''}`)
                .join(', ') || '—',
          },
        ]}
        rows={rows as (GroupRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </AppShell>
  );
}
