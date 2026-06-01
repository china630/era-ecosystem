'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader } from '@era/satellite-kit/ui';
import GuestCardModal from '@/components/GuestCardModal';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type InHouseGuest = {
  reservationId: string;
  guestId: string;
  guestName: string;
  roomNumber: string | null;
  status: string;
};

export default function InHousePage() {
  const { can } = useAuth();
  const t = useTranslations('inHousePage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InHouseGuest[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [guestCardId, setGuestCardId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/reservations?status=IN_HOUSE');
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setRows(
      list.map(
        (r: {
          id: string;
          status: string;
          guest: { id: string; fullName: string };
          room: { roomNumber: string } | null;
        }) => ({
          reservationId: r.id,
          guestId: r.guest.id,
          guestName: r.guest.fullName,
          roomNumber: r.room?.roomNumber ?? null,
          status: r.status,
        }),
      ),
    );
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<InHouseGuest & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.roomNumber ?? '—' },
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setGuestCardId(r.guestId)}
              >
                {r.guestName}
              </button>
            ),
          },
          { key: 'status', header: tc('status'), render: (r) => r.status },
          {
            key: 'folio',
            header: t('folio'),
            render: (r) =>
              can(PERMISSIONS.FOLIO_READ) ? (
                <Link
                  href={`/folio/${r.reservationId}`}
                  className="text-[#2980B9] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('openFolio')}
                </Link>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows as (InHouseGuest & Record<string, unknown>)[]}
        rowKey={(r) => r.reservationId}
        emptyMessage={t('empty')}
      />
      <GuestCardModal
        open={Boolean(guestCardId)}
        guestId={guestCardId}
        onClose={() => setGuestCardId(null)}
      />
    </AppShell>
  );
}
