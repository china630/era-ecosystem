'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EraDataGrid, PageHeader, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import { MessageSquare } from 'lucide-react';
import ReservationCardModal from '@/components/ReservationCardModal';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { fullName: string };
  room: { roomNumber: string; status: string } | null;
  roomType: { code: string };
  agency: { code: string } | null;
  adults: number;
  hasNotes?: boolean;
  notePreview?: string | null;
};

const rowBg: Record<string, string> = {
  IN_HOUSE: 'bg-amber-50',
  CONFIRMED: 'bg-white',
  OPTION: 'bg-slate-50',
  CHECKED_OUT: 'bg-[#EBEDF0]',
  CANCELLED: 'bg-rose-50/50',
  NO_SHOW: 'bg-rose-50',
};

export default function ReservationsListPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationList');
  const tRes = useTranslations('reservationStatus');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notesOnly, setNotesOnly] = useState(searchParams.get('hasNotes') === '1');
  const guestIdFilter = searchParams.get('guestId');

  const load = useCallback(async () => {
    const q = guestIdFilter ? `?guestId=${encodeURIComponent(guestIdFilter)}` : '';
    const res = await fetch(`/api/reports/reservations-grid${q}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, [tc, guestIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNotesOnly(searchParams.get('hasNotes') === '1');
  }, [searchParams]);

  const displayed = useMemo(() => {
    let list = rows;
    if (notesOnly) list = list.filter((r) => r.hasNotes);
    return list;
  }, [rows, notesOnly]);

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={notesOnly ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              onClick={() => setNotesOnly((v) => !v)}
            >
              {t('filterNotes')}
            </button>
            {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
                {t('add')}
              </button>
            ) : null}
          </div>
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          {
            key: 'notes',
            header: t('notes'),
            render: (r) =>
              r.hasNotes ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-amber-700"
                  title={r.notePreview ?? ''}
                  onClick={() => setCardId(r.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-[8rem] truncate text-[12px]">{r.notePreview}</span>
                </button>
              ) : (
                '—'
              ),
          },
          {
            key: 'room',
            header: t('room'),
            render: (r) => r.room?.roomNumber ?? '—',
          },
          {
            key: 'hk',
            header: t('hk'),
            render: (r) => (r.room ? r.room.status.slice(0, 1) : '—'),
          },
          {
            key: 'agency',
            header: t('agency'),
            render: (r) => r.agency?.code ?? '—',
          },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          {
            key: 'arrival',
            header: t('arrival'),
            render: (r) => r.checkInDate.slice(0, 10),
          },
          {
            key: 'departure',
            header: t('departure'),
            render: (r) => r.checkOutDate.slice(0, 10),
          },
          { key: 'type', header: t('roomType'), render: (r) => r.roomType.code },
          { key: 'adult', header: t('adult'), render: (r) => String(r.adults ?? 1) },
          {
            key: 'state',
            header: t('state'),
            render: (r) => tRes(r.status as 'CONFIRMED'),
          },
          {
            key: 'id',
            header: t('resId'),
            render: (r) => (
              <button
                type="button"
                className="font-mono text-[#2980B9] hover:underline"
                onClick={() => setCardId(r.id)}
              >
                {r.id.slice(0, 8)}
              </button>
            ),
          },
        ]}
        rows={displayed.map((r) => ({
          ...r,
          _rowClass: `${rowBg[r.status] ?? ''} ${r.hasNotes ? 'ring-1 ring-inset ring-amber-300/80' : ''}`,
        })) as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <ReservationCardModal
        open={Boolean(cardId) || createOpen}
        reservationId={createOpen ? null : cardId}
        onClose={() => {
          setCardId(null);
          setCreateOpen(false);
          void load();
        }}
      />
    </AppShell>
  );
}
