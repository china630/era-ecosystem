'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
  EraListFilterBar,
  FilterChips,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  ViewportOverlay,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuTimeLabel } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { HkStatusMark } from '@/components/HkStatusMark';

interface Task {
  id: string;
  status: string;
  room: { id: string };
}

interface SheetRow {
  roomId: string;
  roomNumber: string;
  hkCondition?: string;
  status?: string;
  occupancy?: string;
  roomType?: string;
  guests?: string;
  vip?: string;
  arrival?: string;
  arrivalTime?: string;
  departure?: string;
  departureTime?: string;
  jobType?: string;
  jobDuty?: string;
  visitOutcome?: string;
  neededByAt?: string | null;
  maidNames?: string[];
  reservationId?: string | null;
}

type HkFilter = 'all' | 'pending' | 'dirty' | 'inspect';

const OUTCOMES = ['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO'] as const;

function clockUnder(date: string, time: string) {
  return (
    <div className="leading-tight">
      <div>{date || '—'}</div>
      {time ? <div className="text-[11px] text-[#7F8C8D]">{time}</div> : null}
    </div>
  );
}

export default function HousekeepingPage() {
  const { can } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const tRoom = useTranslations('roomStatus');
  const locale = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const searchParams = useSearchParams();
  const focusRoomId = searchParams.get('roomId');
  const focusedOnce = useRef(false);
  const scrolledToRoom = useRef(false);
  const [rooms, setRooms] = useState<Array<{ id?: string; floor?: number }>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<HkFilter>('all');
  const [sheetFloor, setSheetFloor] = useState('2');
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const businessDate = hotelDateKey();
  const [sheetDate, setSheetDate] = useState(businessDate);
  const readOnly = sheetDate !== businessDate;
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    const [tRes, rRes, sRes] = await Promise.all([
      fetch('/api/housekeeping/tasks'),
      fetch('/api/rooms'),
      fetch(`/api/housekeeping/sheet?floor=${sheetFloor}&date=${sheetDate}`),
    ]);
    if (tRes.ok) setTasks(await tRes.json());
    else showApiError(await tRes.json(), tc('loadError'));
    if (rRes.ok) setRooms(await rRes.json());
    if (sRes.ok) setSheetRows(await sRes.json());
  }, [tc, sheetFloor, sheetDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!focusRoomId || focusedOnce.current) return;
    const room = rooms.find((row) => row.id === focusRoomId);
    if (!room) return;
    focusedOnce.current = true;
    setFilter('all');
    if (typeof room.floor === 'number') setSheetFloor(String(room.floor));
  }, [focusRoomId, rooms]);

  const floors = useMemo(() => {
    const set = new Set<number>();
    for (const room of rooms) {
      if (typeof room.floor === 'number') set.add(room.floor);
    }
    return [...set].sort((a, b) => a - b);
  }, [rooms]);

  const openTaskByRoom = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      if (task.status === 'DONE') continue;
      if (!map.has(task.room.id)) map.set(task.room.id, task);
    }
    return map;
  }, [tasks]);

  function knownLabel(group: 'job' | 'hkCond' | 'occ', code: string) {
    const allowed: Record<typeof group, string[]> = {
      job: ['STAYOVER', 'DEPARTURE', 'ARRIVAL_PREP', 'NSR', 'OTHER', 'DEEP', 'LINEN', 'OK', 'STAY', 'NONE'],
      hkCond: ['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED'],
      occ: ['OCC', 'AVL'],
    };
    if (!code || !allowed[group].includes(code)) return code || '—';
    return t(`${group}.${code}`);
  }

  function matches(row: SheetRow, task: Task | undefined) {
    const hk = String(row.hkCondition ?? row.status ?? '');
    if (filter === 'dirty') return hk === 'DIRTY' || hk === 'PICKUP';
    if (filter === 'inspect') return hk === 'CLEAN' && row.occupancy === 'AVL';
    if (filter === 'pending') {
      const duty = String(row.jobDuty ?? '');
      const openDuty = Boolean(duty) && duty !== 'OTHER' && duty !== 'NONE' && !row.visitOutcome;
      return Boolean(task) || openDuty;
    }
    return true;
  }

  // Soft priority comes from the sheet API (departure → VIP → needed-by → dirty → duty → room#).
  const visibleSheet = useMemo(() => {
    return sheetRows.filter((row) => matches(row, readOnly ? undefined : openTaskByRoom.get(row.roomId)));
  }, [sheetRows, filter, readOnly, openTaskByRoom]);

  const counts = useMemo(() => {
    const base = { all: sheetRows.length, pending: 0, dirty: 0, inspect: 0 };
    for (const row of sheetRows) {
      const task = readOnly ? undefined : openTaskByRoom.get(row.roomId);
      const hk = String(row.hkCondition ?? row.status ?? '');
      const duty = String(row.jobDuty ?? '');
      const openDuty = Boolean(duty) && duty !== 'OTHER' && duty !== 'NONE' && !row.visitOutcome;
      if (task || openDuty) base.pending += 1;
      if (hk === 'DIRTY' || hk === 'PICKUP') base.dirty += 1;
      if (hk === 'CLEAN' && row.occupancy === 'AVL') base.inspect += 1;
    }
    return base;
  }, [sheetRows, openTaskByRoom, readOnly]);

  const maidNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of sheetRows) {
      for (const name of row.maidNames ?? []) {
        if (name) names.add(name);
      }
    }
    return [...names];
  }, [sheetRows]);

  async function completeTask(taskId: string) {
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    const status = data.room?.status as string | undefined;
    setMsg(
      res.ok
        ? t('taskDone', { status: status ? tRoom(status as 'CLEAN') : status ?? tc('dash') })
        : data.error,
    );
    await load();
  }

  async function markInspected(roomId: string, roomNumber: string) {
    const res = await fetch(`/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hkCondition: 'INSPECTED' }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? t('roomInspected', { room: data.roomNumber ?? roomNumber })
        : data?.code === 'OCCUPIED_HK_LOCKED'
          ? t('occupiedHkLocked')
          : data.error,
    );
    await load();
  }

  if (!can(PERMISSIONS.HOUSEKEEPING_MANAGE) && !can(PERMISSIONS.ROOMS_STATUS)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionHousekeeping')}</p>;
  }

  const pdfLang = locale === 'en' || locale === 'ru' ? locale : 'az';
  const headerActions = (
    <div className="flex flex-wrap gap-2 print:hidden">
      <a
        className={SECONDARY_BUTTON_CLASS}
        href={`/api/housekeeping/sheet?format=pdf&date=${sheetDate}&floor=${sheetFloor}&lang=${pdfLang}`}
      >
        {t('downloadSheetPdf')}
      </a>
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setFullscreen((v) => !v)}>
        {fullscreen ? (
          <>
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            {t('exitFullscreen')}
          </>
        ) : (
          <>
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            {t('enterFullscreen')}
          </>
        )}
      </button>
    </div>
  );

  const filters = (
    <EraListFilterBar
      resetLabel={tc('filterReset')}
      onReset={() => {
        setFilter('all');
        setSheetDate(businessDate);
      }}
    >
      <div className="w-40">
        <DatePicker
          label={t('sheetDate')}
          value={sheetDate}
          onChange={(next) => {
            if (next) setSheetDate(next);
          }}
          placeholder={tc('datePlaceholder')}
          preset="date"
          fluid
        />
      </div>
      <div className="w-40">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('floor')}
          value={sheetFloor}
          onChange={(v) => setSheetFloor(String(v))}
          options={(floors.length ? floors : [Number(sheetFloor)]).map((f) => ({
            value: String(f),
            label: String(f),
          }))}
        />
      </div>
      <FilterChips
        ariaLabel={t('filterStatus')}
        value={filter}
        onChange={(id) => setFilter(id as HkFilter)}
        items={[
          { id: 'all', label: `${t('filterAll')} (${counts.all})` },
          { id: 'pending', label: `${t('filterPending')} (${counts.pending})` },
          { id: 'dirty', label: `${t('filterDirty')} (${counts.dirty})` },
          { id: 'inspect', label: `${t('chipInspect')} (${counts.inspect})` },
        ]}
      />
    </EraListFilterBar>
  );

  const sheet = (
    <section className={`${CARD_CONTAINER_CLASS} flex min-h-0 flex-1 flex-col p-4 print:shadow-none`} id="hk-floor-sheet">
      <h2 className="mb-3 text-sm font-semibold text-[#34495E]">
        {t('sheetTitle')}
        {' · '}
        {t('maidLine', {
          floor: sheetFloor,
          names: maidNames.length ? maidNames.join(', ') : tc('dash'),
        })}
        {' · '}
        {t('inList')}: {visibleSheet.length}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-[#7F8C8D]">
              {[
                t('colRoom'),
                t('hk'),
                t('colOcc'),
                t('colType'),
                t('colGuest'),
                'VIP',
                t('colJob'),
                t('colDuty'),
                t('colArrive'),
                t('colDepart'),
                t('neededBy'),
                t('outcome'),
                tc('actions'),
              ].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className={`sticky top-0 z-20 border-b border-[#D5DADF] bg-white px-1 py-2 ${
                    index === 0 ? 'left-0 z-30' : ''
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSheet.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-3 text-[#7F8C8D]">
                  {sheetRows.length === 0 ? t('sheetEmpty') : t('sheetEmptyFocus')}
                </td>
              </tr>
            ) : null}
            {visibleSheet.map((row) => {
              const task = readOnly ? undefined : openTaskByRoom.get(row.roomId);
              const hk = String(row.hkCondition ?? row.status ?? '');
              const noTask = !readOnly && (hk === 'DIRTY' || hk === 'PICKUP') && !task;
              const vacantClean = hk === 'CLEAN' && row.occupancy === 'AVL';
              const rowBg = noTask ? 'bg-amber-50' : 'bg-white';
              return (
                <tr key={row.roomId} className={rowBg}>
                  <td
                    ref={
                      focusRoomId === row.roomId
                        ? (el) => {
                            if (!el || scrolledToRoom.current) return;
                            scrolledToRoom.current = true;
                            el.scrollIntoView({ block: 'nearest' });
                          }
                        : undefined
                    }
                    className={`sticky left-0 z-10 px-1 py-1 font-semibold ${rowBg} ${
                      focusRoomId === row.roomId ? 'ring-2 ring-inset ring-[#2980B9]' : ''
                    }`}
                  >
                    {row.roomNumber}
                    {noTask ? <div className="text-[11px] font-normal text-amber-800">{t('noTask')}</div> : null}
                  </td>
                  <td className="px-1 py-1">
                    <HkStatusMark status={hk} />
                  </td>
                  <td className="px-1 py-1">{knownLabel('occ', String(row.occupancy ?? ''))}</td>
                  <td className="px-1 py-1">{row.roomType}</td>
                  <td className="px-1 py-1">{row.guests || '—'}</td>
                  <td className="px-1 py-1">{row.vip || '—'}</td>
                  <td className="px-1 py-1">{knownLabel('job', String(row.jobType ?? ''))}</td>
                  <td className="px-1 py-1">{knownLabel('job', String(row.jobDuty ?? ''))}</td>
                  <td className="px-1 py-1">{clockUnder(String(row.arrival ?? ''), String(row.arrivalTime ?? ''))}</td>
                  <td className="px-1 py-1">{clockUnder(String(row.departure ?? ''), String(row.departureTime ?? ''))}</td>
                  <td className="px-1 py-1">
                    <input
                      type="time"
                      className="w-24 rounded border border-[#D5DADF] px-1 py-0.5 text-[11px] disabled:bg-[#F4F6F7]"
                      key={`${row.roomId}-${sheetDate}`}
                      aria-label={t('neededBy')}
                      disabled={readOnly}
                      defaultValue={row.neededByAt ? bakuTimeLabel(String(row.neededByAt)) : ''}
                      onBlur={(e) => {
                        const time = e.target.value;
                        if (!time) return;
                        void fetch('/api/housekeeping/needed-by', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId: row.roomId, date: sheetDate, time }),
                        }).then(() => load());
                      }}
                    />
                  </td>
                  <td className="px-1 py-1 align-middle">
                    {row.reservationId ? (
                      <div className="w-[4.5rem]">
                        <CatalogField
                          kind="CLOSED_SMALL"
                          className="!space-y-0 [&_label]:sr-only [&_select]:h-7 [&_select]:min-h-0 [&_select]:py-0 [&_select]:text-[11px] [&_select]:leading-tight"
                          label={t('outcome')}
                          value={String(row.visitOutcome ?? '')}
                          disabled={readOnly}
                          onChange={(v) => {
                            const next = String(v ?? '');
                            void fetch('/api/housekeeping/outcome', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(
                                next
                                  ? { roomId: row.roomId, date: sheetDate, outcome: next }
                                  : { roomId: row.roomId, date: sheetDate, clear: true },
                              ),
                            }).then(() => load());
                          }}
                          options={OUTCOMES.map((code) => ({
                            value: code,
                            label: code === 'REFUSED' ? t('refused') : code,
                          }))}
                        />
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-1 py-1 align-middle">
                    {(() => {
                      const canComplete = Boolean(task && can(PERMISSIONS.HOUSEKEEPING_MANAGE));
                      const canInspect = !readOnly && vacantClean && can(PERMISSIONS.ROOMS_STATUS);
                      if (!canComplete && !canInspect) return '—';
                      return (
                        <div className="flex flex-wrap items-center gap-1">
                          {canComplete && task ? (
                            <button
                              type="button"
                              className="shrink-0 rounded border border-[#D5DADF] bg-white px-1.5 py-0.5 text-[11px] leading-none text-[#34495E]"
                              onClick={() => completeTask(task.id)}
                            >
                              {t('completeClean')}
                            </button>
                          ) : null}
                          {canInspect ? (
                            <button
                              type="button"
                              className="shrink-0 rounded border border-[#D5DADF] bg-white px-1.5 py-0.5 text-[11px] leading-none text-[#34495E]"
                              onClick={() => markInspected(row.roomId, row.roomNumber)}
                            >
                              {t('inspectAction')}
                            </button>
                          ) : null}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  if (fullscreen) {
    return (
      <ViewportOverlay
        className="fixed inset-0 z-[180] flex flex-col bg-[#EBEDF0] px-4 py-3 sm:px-6"
        label={t('fullscreenTitle')}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-[#2C3E50]">
            {t('sheetTitle')}
            {readOnly ? <span className="ml-2 text-[13px] font-normal text-[#7F8C8D]">{t('sheetReadOnly')}</span> : null}
          </h1>
          {headerActions}
        </div>
        <div className="shrink-0">{filters}</div>
        {msg ? <p className="mb-2 rounded-lg bg-white px-4 py-2 text-[13px] text-[#34495E]">{msg}</p> : null}
        {sheet}
      </ViewportOverlay>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={readOnly ? t('sheetReadOnly') : t('sheetHint')} actions={headerActions} />
      {msg ? (
        <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">{msg}</p>
      ) : null}
      {filters}
      {sheet}
    </>
  );
}
