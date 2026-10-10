'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  CHIP_GROUP_CLASS,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  usePaginatedList,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from "@/components/HotelDataGrid";
import { Cake, MessageSquare, Plus } from 'lucide-react';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { birthdayIconVisible, birthdayNightInStay } from '@/lib/stay-birthday';
import ReservationCardModal from '@/components/ReservationCardModal';
import { ReservationNoteLine } from '@/components/reservation-card/ReservationNoteLine';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useListPaginationLabels } from '@/hooks/useListPaginationLabels';
import { catalogLabel } from '@/lib/catalog-label';
import {
  RESERVATION_QUEUE_CODES,
  isReservationQueue,
  queueIgnoresDates,
  type ReservationQueue,
} from '@/lib/reservation-queue';

type Row = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { fullName: string; birthDate?: string | null };
  guestLabel?: string;
  noteText?: string | null;
  room: { roomNumber: string; status: string } | null;
  roomType: { code: string };
  agency: { code: string } | null;
  adults: number;
  hasNotes?: boolean;
  notePreview?: string | null;
  notes?: Array<{ noteType: string; text: string }>;
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
  queue: ReservationQueue;
  overdue: boolean;
  noteQ: string;
  notesOnly: boolean;
  guestId: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  dir: 'asc' | 'desc' | '';
};

export default function ReservationsListPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationList');
  const tRes = useTranslations('reservationStatus');
  const tc = useTranslations('common');
  const locale = useLocale();
  const paginationLabels = useListPaginationLabels();
  const searchParams = useSearchParams();
  const guestIdFilter = searchParams.get('guestId') ?? '';

  const [cardId, setCardId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState('');
  const [queue, setQueue] = useState<ReservationQueue>(() => {
    const fromUrl = searchParams.get('queue');
    if (isReservationQueue(fromUrl)) return fromUrl;
    return searchParams.get('guestId') ? 'all' : 'bookings';
  });
  const [overdue, setOverdue] = useState(searchParams.get('overdue') === '1');
  const [queueLabels, setQueueLabels] = useState<Record<string, string>>({});
  const [noteQ, setNoteQ] = useState(searchParams.get('noteQ') ?? '');
  const [notesOnly, setNotesOnly] = useState(searchParams.get('hasNotes') === '1');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (guestIdFilter) setQueue('all');
  }, [guestIdFilter]);

  useEffect(() => {
    void fetch('/api/master/lookups?kind=RESERVATION_QUEUE&activeOnly=1')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ code: string; name?: string; nameAz?: string; nameRu?: string; nameEn?: string }>) => {
        if (!Array.isArray(rows)) return;
        const next: Record<string, string> = {};
        for (const row of rows) next[row.code] = catalogLabel(row, locale);
        setQueueLabels(next);
      })
      .catch(() => setQueueLabels({}));
  }, [locale]);

  useEffect(() => {
    setNotesOnly(searchParams.get('hasNotes') === '1');
  }, [searchParams]);

  const filters = useMemo<ListFilters>(
    () => ({
      q,
      queue,
      overdue: queue === 'bookings' && overdue,
      noteQ,
      notesOnly,
      guestId: guestIdFilter,
      dateFrom,
      dateTo,
      sort: sortKey,
      dir: sortDir,
    }),
    [q, queue, overdue, noteQ, notesOnly, guestIdFilter, dateFrom, dateTo, sortKey, sortDir],
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
        queue: f.queue,
      });
      if (f.overdue) params.set('overdue', '1');
      if (f.guestId) params.set('guestId', f.guestId);
      if (f.q.trim()) params.set('q', f.q.trim());
      if (f.noteQ.trim()) params.set('noteQ', f.noteQ.trim());
      if (f.notesOnly) params.set('hasNotes', '1');
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo) params.set('dateTo', f.dateTo);
      if (f.sort && f.dir) {
        params.set('sort', f.sort);
        params.set('dir', f.dir);
      }
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
      <div className="mb-4 shrink-0">
        <PageHeader
          title={t('title')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('add')}
                </button>
              ) : null}
            </div>
          }
        />
      </div>
      <div className={`${CHIP_GROUP_CLASS} mb-3 shrink-0`} role="tablist">
        {RESERVATION_QUEUE_CODES.map((code) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={queue === code}
            className={queue === code ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            onClick={() => {
              setQueue(code);
              setOverdue(false);
            }}
          >
            {queueLabels[code] || t(`queue.${code}`)}
          </button>
        ))}
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={tc('filterReset')}
            onReset={() => {
              setQ('');
              setQueue(guestIdFilter ? 'all' : 'bookings');
              setOverdue(false);
              setNoteQ('');
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
            {queueIgnoresDates(queue) ? null : (
              <>
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
              </>
            )}
            <Field
              label={t('notes')}
              preset="longText"
              value={noteQ}
              onChange={(e) => setNoteQ(e.target.value)}
            />
          </EraListFilterBar>
        }
        toolbar={(() => {
          const selected = rows.find((row) => row.id === selectedId);
          const selectedNotes = (selected?.notes ?? []).filter((note) => (note.text ?? '').trim());
          if (selectedNotes.length === 0) return undefined;
          return (
            <ReservationNoteLine
              className="mb-1 rounded-md border border-[#D5DADF] bg-[#F8F9FA] px-2.5 py-1 text-[12px] leading-5 text-[#34495E]"
              notes={selectedNotes}
            />
          );
        })()}
        table={
          <div className="flex min-h-0 flex-1 flex-col">
          <HotelDataGrid<Row & Record<string, unknown>>
            columns={[
              {
                key: 'room',
                header: t('room'),
                sortable: true,
                render: (r) => r.room?.roomNumber ?? '—',
              },
              {
                key: 'hk',
                header: t('hk'),
                sortable: true,
                render: (r) => (r.room ? r.room.status.slice(0, 1) : '—'),
              },
              {
                key: 'agency',
                header: t('agency'),
                sortable: true,
                render: (r) => r.agency?.code ?? '—',
              },
              {
                key: 'guest',
                header: t('guest'),
                sortable: true,
                render: (r) => {
                  const night = birthdayNightInStay(
                    r.guest.birthDate,
                    r.checkInDate,
                    r.checkOutDate,
                  );
                  const showCake = night != null && birthdayIconVisible(night, todayBakuYmd());
                  return (
                    <span className="inline-flex items-center gap-1">
                      {showCake ? (
                        <Cake className="h-4 w-4 shrink-0 text-amber-500" aria-label={t('birthday')} />
                      ) : null}
                      {r.guestLabel || r.guest.fullName}
                    </span>
                  );
                },
              },
              {
                key: 'arrival',
                header: t('arrival'),
                sortable: true,
                render: (r) => String(r.checkInDate).slice(0, 10),
              },
              {
                key: 'departure',
                header: t('departure'),
                sortable: true,
                render: (r) => String(r.checkOutDate).slice(0, 10),
              },
              { key: 'type', header: t('roomType'), sortable: true, render: (r) => r.roomType.code },
              {
                key: 'adult',
                header: t('adult'),
                sortable: true,
                render: (r) => String(r.adults ?? 1),
              },
              {
                key: 'state',
                header: t('state'),
                sortable: true,
                render: (r) => tRes(r.status as 'CONFIRMED'),
              },
              {
                key: 'notes',
                header: t('notes'),
                sortable: true,
                render: (r) =>
                  r.hasNotes ? (
                    <button
                      type="button"
                      className="inline-flex items-center text-amber-700"
                      title={t('notes')}
                      aria-label={t('notes')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(r.id);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'id',
                header: t('resId'),
                sortable: true,
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
            sort={sortKey && sortDir ? { key: sortKey, dir: sortDir } : null}
            onSortChange={(next) => {
              setSortKey(next.key);
              setSortDir(next.dir);
              setPage(1);
            }}
            onRowClick={(r) => setSelectedId(r.id)}
            onRowDoubleClick={(r) => setCardId(r.id)}
            emptyMessage={loading ? tc('loading') : tc('empty')}
            pagination={false}
            paginationMode="server"
            embedded
            rowClassName={(r) =>
              [
                ROW_BG[r.status] ?? '',
                r.hasNotes ? 'ring-1 ring-inset ring-amber-300/80' : '',
                r.id === selectedId ? 'ring-2 ring-inset ring-[#2980B9]' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
          </div>
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
