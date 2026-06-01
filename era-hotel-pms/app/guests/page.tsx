'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import GuestCardModal from '@/components/GuestCardModal';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type GuestRow = {
  id: string;
  fullName: string;
  nationality: string;
  phone: string | null;
  nationalIdFin: string | null;
  passportNumber: string | null;
};

export default function GuestsPage() {
  const { can } = useAuth();
  const t = useTranslations('guestsPage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardGuestId, setCardGuestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/guests');
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

  function openCreate() {
    setCardGuestId(null);
    setCardOpen(true);
  }

  function openEdit(guest: GuestRow) {
    setCardGuestId(guest.id);
    setCardOpen(true);
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<GuestRow & Record<string, unknown>>
        columns={[
          { key: 'name', header: t('name'), render: (r) => r.fullName },
          { key: 'nationality', header: t('nationality'), render: (r) => r.nationality },
          { key: 'phone', header: t('phone'), render: (r) => r.phone ?? '—' },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) =>
              can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => openEdit(r)}
                >
                  {t('viewProfile')}
                </button>
              ) : null,
          },
        ]}
        rows={rows as (GuestRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        onAdd={can(PERMISSIONS.RESERVATIONS_WRITE) ? openCreate : undefined}
        addLabel={t('addGuest')}
        emptyMessage={t('empty')}
      />

      <GuestCardModal
        open={cardOpen}
        guestId={cardGuestId}
        onClose={() => {
          setCardOpen(false);
          setCardGuestId(null);
          void load();
        }}
      />
    </AppShell>
  );
}
