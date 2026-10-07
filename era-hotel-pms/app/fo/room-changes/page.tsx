'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function roomMoveReason(
  row: { reasonCode?: string | null; notes?: string | null },
  t: (key: string) => string,
): string {
  const raw = (row.reasonCode ?? '').trim();
  const note = (row.notes ?? '').trim();
  if (raw === 'CARD_ASSIGN' || note === 'CARD_ASSIGN') return t('reasonCard');
  if (raw === 'SWAP') return t('reasonSwap');
  if (raw === 'RELOCATE') return t('reasonRelocate');
  if (note) return note;
  return t('reasonOther');
}

type Row = {
  id: string;
  status: string;
  effectiveAt: string;
  notes?: string | null;
  reasonCode?: string | null;
  reservation: { id: string; guest: { fullName: string } };
  fromRoom: { roomNumber: string } | null;
  toRoom: { roomNumber: string } | null;
};

export default function RoomChangesPage() {
  const { can } = useAuth();
  const t = useTranslations('roomChanges');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [cardId, setCardId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/room-changes');
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
    const matched = !q
      ? rows
      : rows.filter((r) =>
          `${r.reservation.guest.fullName} ${r.fromRoom?.roomNumber ?? ''} ${r.toRoom?.roomNumber ?? ''} ${r.status}`
            .toLowerCase()
            .includes(q),
        );
    return [...matched].sort((a, b) => String(b.effectiveAt).localeCompare(String(a.effectiveAt)));
  }, [rows, debouncedQ]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setQ('')}>
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </EraListFilterBar>
      <HotelDataGrid<Row & Record<string, unknown>>
        columns={[
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setCardId(r.reservation.id)}
              >
                {r.reservation.guest.fullName}
              </button>
            ),
          },
          { key: 'from', header: t('from'), render: (r) => r.fromRoom?.roomNumber ?? '—' },
          { key: 'to', header: t('to'), render: (r) => r.toRoom?.roomNumber ?? '—' },
          {
            key: 'when',
            header: t('effective'),
            render: (r) => bakuDateTimeDisplay(r.effectiveAt),
          },
          { key: 'reason', header: t('reason'), render: (r) => roomMoveReason(r, t) },
          { key: 'status', header: t('status') },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
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
