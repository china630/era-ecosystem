'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldSelect,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  usePaginatedList,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import { MessageSquare } from 'lucide-react';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useListPaginationLabels } from '@/hooks/useListPaginationLabels';

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

const ROW_BG: Record<string, string> = {
  IN_HOUSE: 'bg-amber-50',
  CONFIRMED: 'bg-white',
  OPTION: 'bg-slate-50',
  CHECKED_OUT: 'bg-[#EBEDF0]',
  CANCELLED: 'bg-rose-50/50',
  NO_SHOW: 'bg-rose-50',
};

type ListFilters = {
  q: string;
  status: string;
  notesOnly: boolean;
  guestId: string;
  dateFrom: string;
  dateTo: string;
};

export default function ReservationsListPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationList');
  const tRes = useTranslations('reservationStatus');
  const tc = useTranslations('common');
  const paginationLabels = useListPaginationLabels();
  const searchParams = useSearchParams();
  const guestIdFilter = searchParams.get('guestId') ?? '';

  const [cardId, setCardId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState(() =>
    searchParams.get('guestId') ? 'ALL' : 'LIVE',
  );
  const [notesOnly, setNotesOnly] = useState(searchParams.get('hasNotes') === '1');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (guestIdFilter) setStatusFilter('ALL');
  }, [guestIdFilter]);

  useEffect(() => {
    setNotesOnly(searchParams.get('hasNotes') === '1');
  }, [searchParams]);

  const filters = useMemo<ListFilters>(
    () => ({
      q,
      status: statusFilter,
      notesOnly,
      guestId: guestIdFilter,
      dateFrom,
      dateTo,
    }),
    [q, statusFilter, notesOnly, guestIdFilter, dateFrom, dateTo],
  );

  const fetcher = useCallback(
    async ({
      page,
      pageSize,
      filters: f,
    }: {
      page: number;
      pageSize: number;
      filters: ListFilters;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: f.status || 'LIVE',
      });
      if (f.guestId) params.set('guestId', f.guestId);
      if (f.q.trim()) params.set('q', f.q.trim());
      if (f.notesOnly) params.set('hasNotes', '1');
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo) params.set('dateTo', f.dateTo);
      const res = await fetch(`/api/reports/reservations-grid?${params}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        throw new Error(typeof data?.error === 'string' ? data.error : tc('loadError'));
      }
      return data;
    },
    [tc],
  );

  const {
    items: rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    reload,
  } = usePaginatedList<Row, ListFilters>({ fetcher, filters });

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t('title')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => setCreateOpen(true)}
                >
                  {t('add')}
                </button>
              ) : null}
            </div>
          }
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc('filterReset')}
            onReset={() => {
              setQ('');
              setStatusFilter(guestIdFilter ? 'ALL' : 'LIVE');
              setNotesOnly(false);
              setDateFrom('');
              setDateTo('');
            }}
            actionsExtra={
              <button
                type="button"
                className={notesOnly ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
                onClick={() => setNotesOnly((v) => !v)}
              >
                {t('filterNotes')}
              </button>
            }
          >
            <Field
              label={tc('search')}
              preset="longText"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FieldSelect
              label={tc('status')}
              preset="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="LIVE">{t('statusLive')}</option>
              <option value="ALL">{tc('all')}</option>
              <option value="IN_HOUSE">IN_HOUSE</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="OPTION">OPTION</option>
              <option value="CHECKED_OUT">CHECKED_OUT</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="NO_SHOW">NO_SHOW</option>
            </FieldSelect>
            <DatePicker
              label={tc('from')}
              value={dateFrom}
              onChange={setDateFrom}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
            <DatePicker
              label={tc('to')}
              value={dateTo}
              onChange={setDateTo}
              placeholder={tc('datePlaceholder')}
              openCalendarLabel={tc('openCalendar')}
            />
          </EraListFilterBar>
        }
        table={
          <HotelDataGrid<Row & Record<string, unknown>>
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
                      <span className="max-w-[8rem] truncate text-[12px]">
                        {r.notePreview}
                      </span>
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
                render: (r) => String(r.checkInDate).slice(0, 10),
              },
              {
                key: 'departure',
                header: t('departure'),
                render: (r) => String(r.checkOutDate).slice(0, 10),
              },
              { key: 'type', header: t('roomType'), render: (r) => r.roomType.code },
              {
                key: 'adult',
                header: t('adult'),
                render: (r) => String(r.adults ?? 1),
              },
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
            rows={rows as (Row & Record<string, unknown>)[]}
            rowKey={(r) => r.id}
            emptyMessage={loading ? tc('loading') : tc('empty')}
            pagination={false}
            paginationMode="server"
            embedded
            rowClassName={(r) =>
              [
                ROW_BG[r.status] ?? '',
                r.hasNotes ? 'ring-1 ring-inset ring-amber-300/80' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={paginationLabels}
          />
        }
      />
      <ReservationCardModal
        open={Boolean(cardId) || createOpen}
        reservationId={createOpen ? null : cardId}
        onClose={() => {
          setCardId(null);
          setCreateOpen(false);
          void reload();
        }}
      />
    </div>
  );
}
