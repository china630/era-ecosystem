'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { GroupCreateModal } from '@/components/GroupCreateModal';
import ReservationCardModal from '@/components/ReservationCardModal';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

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
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
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
            header: t('agency'),
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
              r.reservations.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {r.reservations.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className="text-left font-mono text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setCardId(x.id)}
                    >
                      {x.guest.fullName}
                      {x.room ? ` · ${x.room.roomNumber}` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows as (GroupRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <GroupCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      <ReservationCardModal
        open={Boolean(cardId)}
        reservationId={cardId}
        onClose={() => {
          setCardId(null);
          void load();
        }}
      />
    </AppShell>
  );
}
