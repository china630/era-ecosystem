'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import GroupBookingModal from '@/components/GroupBookingModal';
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
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservation-groups');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.code} ${r.name ?? ''} ${r.agency?.code ?? ''}`.toLowerCase().includes(q),
    );
  }, [rows, debouncedQ]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.RESERVATIONS_WRITE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              + {tn('groupBooking')}
            </button>
          ) : undefined
        }
      />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setQ('')}>
        <Field label={tc('search')} preset="longText" value={q} onChange={(e) => setQ(e.target.value)} />
      </EraListFilterBar>
      <HotelDataGrid<GroupRow & Record<string, unknown>>
        columns={[
          {
            key: 'code',
            header: t('code'),
            render: (r) => (
              <button
                type="button"
                className="text-left font-mono text-[12px] text-[#2980B9] hover:underline"
                title={t('openBooking')}
                onClick={() => {
                  const first = r.reservations[0];
                  if (first) setCardId(first.id);
                }}
              >
                {r.code}
              </button>
            ),
          },
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
        rows={filtered as (GroupRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <GroupBookingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={({ firstStayId }) => {
          void load();
          if (firstStayId) setCardId(firstStayId);
        }}
      />
      <ReservationCardModal
        open={Boolean(cardId)}
        reservationId={cardId}
        onClose={() => {
          setCardId(null);
          void load();
        }}
      />
    </>
  );
}
