'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  EraListFilterBar,
  Field,
  FilterChips,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  ViewportOverlay,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { stayListHasInHouse } from '@/lib/occupied-hk-lock';
import { HkStatusMark } from '@/components/HkStatusMark';

interface BoardRoom {
  id: string;
  roomNumber: string;
  floor?: number;
  status: string;
  hkCondition?: string | null;
  inventoryStatus?: string | null;
  roomType: { code: string };
  reservations?: Array<{ status?: string }>;
}

type BoardFilter = 'all' | 'dirtyVacant' | 'cleanVacant' | 'inspect' | 'ooo' | 'oos';

const HK = ['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED'] as const;

export default function HkRoomsPage() {
  const { can } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [floor, setFloor] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/rooms');
    const data = await res.json();
    if (res.ok) setRooms(data);
    else showApiError(data, tc('loadError'));
  }, [tc]);

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

  const floors = useMemo(() => {
    const set = new Set<number>();
    for (const room of rooms) {
      if (typeof room.floor === 'number') set.add(room.floor);
    }
    return [...set].sort((a, b) => a - b);
  }, [rooms]);

  function occupied(room: BoardRoom) {
    return stayListHasInHouse(room.reservations);
  }

  function hkOf(room: BoardRoom) {
    return String(room.hkCondition ?? room.status ?? '');
  }

  function matches(room: BoardRoom) {
    if (floor && String(room.floor ?? '') !== floor) return false;
    if (roomQuery.trim() && !room.roomNumber.toLowerCase().includes(roomQuery.trim().toLowerCase())) return false;
    const hk = hkOf(room);
    const occ = occupied(room);
    const inv = room.inventoryStatus ?? '';
    if (filter === 'ooo') return inv === 'OOO' || room.status === 'OOO';
    if (filter === 'oos') return inv === 'OOS' || room.status === 'OOS';
    if (inv === 'OOO' || inv === 'OOS' || room.status === 'OOO' || room.status === 'OOS') return filter === 'all';
    if (filter === 'dirtyVacant') return !occ && (hk === 'DIRTY' || hk === 'PICKUP');
    if (filter === 'cleanVacant') return !occ && (hk === 'CLEAN' || hk === 'INSPECTED');
    if (filter === 'inspect') return !occ && hk === 'CLEAN';
    return true;
  }

  const visible = rooms.filter(matches);

  const counts = useMemo(() => {
    const base = { all: 0, dirtyVacant: 0, cleanVacant: 0, inspect: 0, ooo: 0, oos: 0 };
    for (const room of rooms) {
      if (floor && String(room.floor ?? '') !== floor) continue;
      if (roomQuery.trim() && !room.roomNumber.toLowerCase().includes(roomQuery.trim().toLowerCase())) continue;
      base.all += 1;
      const hk = hkOf(room);
      const occ = occupied(room);
      const inv = room.inventoryStatus ?? '';
      if (inv === 'OOO' || room.status === 'OOO') base.ooo += 1;
      else if (inv === 'OOS' || room.status === 'OOS') base.oos += 1;
      else if (!occ && (hk === 'DIRTY' || hk === 'PICKUP')) base.dirtyVacant += 1;
      else if (!occ && (hk === 'CLEAN' || hk === 'INSPECTED')) base.cleanVacant += 1;
      if (!occ && hk === 'CLEAN' && inv !== 'OOO' && inv !== 'OOS') base.inspect += 1;
    }
    return base;
  }, [rooms, floor, roomQuery]);

  async function setHk(roomId: string, hkCondition: string) {
    const res = await fetch('/api/housekeeping/condition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, hkCondition }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.code === 'OCCUPIED_HK_LOCKED' ? t('occupiedHkLocked') : data.error);
      showApiError(data, tc('loadError'));
      return;
    }
    setMsg(null);
    await load();
  }

  if (!can(PERMISSIONS.HOUSEKEEPING_MANAGE) && !can(PERMISSIONS.ROOMS_STATUS)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionHousekeeping')}</p>;
  }

  const canSet = can(PERMISSIONS.ROOMS_STATUS) || can(PERMISSIONS.HOUSEKEEPING_MANAGE);

  const headerActions = (
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
  );

  const filters = (
    <EraListFilterBar
      resetLabel={tc('filterReset')}
      onReset={() => {
        setFilter('all');
        setFloor('');
        setRoomQuery('');
      }}
    >
      <div className="w-40">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('floor')}
          value={floor}
          onChange={(v) => setFloor(String(v))}
          options={[{ value: '', label: t('filterAll') }, ...floors.map((f) => ({ value: String(f), label: String(f) }))]}
        />
      </div>
      <Field
        label={t('colRoom')}
        preset="shortText"
        value={roomQuery}
        onChange={(e) => setRoomQuery(e.target.value)}
      />
      <FilterChips
        ariaLabel={t('filterStatus')}
        value={filter}
        onChange={(id) => setFilter(id as BoardFilter)}
        items={[
          { id: 'all', label: `${t('filterAll')} (${counts.all})` },
          { id: 'dirtyVacant', label: `${t('chipDirtyVacant')} (${counts.dirtyVacant})` },
          { id: 'cleanVacant', label: `${t('chipCleanVacant')} (${counts.cleanVacant})` },
          { id: 'inspect', label: `${t('chipInspect')} (${counts.inspect})` },
          { id: 'ooo', label: `${t('chipOoo')} (${counts.ooo})` },
          { id: 'oos', label: `${t('chipOos')} (${counts.oos})` },
        ]}
      />
    </EraListFilterBar>
  );

  const table = (
    <section className={`${CARD_CONTAINER_CLASS} flex min-h-0 flex-1 flex-col p-4`}>
      <h2 className="mb-3 text-sm font-semibold text-[#34495E]">
        {t('roomsBoardTitle')} · {t('inList')}: {visible.length}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-[#7F8C8D]">
              {[t('colOcc'), t('colRoom'), t('colType'), t('floor'), t('hk'), t('setHk')].map((label) => (
                <th key={label} className="sticky top-0 z-10 border-b border-[#D5DADF] bg-white px-2 py-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-[#7F8C8D]">
                  {t('sheetEmptyFocus')}
                </td>
              </tr>
            ) : null}
            {visible.map((room) => {
              const occ = occupied(room);
              const closed = room.inventoryStatus === 'OOO' || room.inventoryStatus === 'OOS' || room.status === 'OOO' || room.status === 'OOS';
              const hk = hkOf(room);
              const numberBg = closed ? 'bg-[#ECEFF1]' : occ ? 'bg-rose-100' : 'bg-emerald-50';
              return (
                <tr key={room.id}>
                  <td className="px-2 py-1">{occ ? t('occ.OCC') : t('occ.AVL')}</td>
                  <td className="px-2 py-1">
                    <span className={`inline-flex min-w-[3.5rem] justify-center rounded px-2 py-0.5 font-semibold ${numberBg}`}>
                      {room.roomNumber}
                    </span>
                  </td>
                  <td className="px-2 py-1">{room.roomType.code}</td>
                  <td className="px-2 py-1">{room.floor ?? '—'}</td>
                  <td className="px-2 py-1">
                    {closed ? <span className="text-[12px] text-[#7F8C8D]">{room.inventoryStatus || room.status}</span> : <HkStatusMark status={hk} />}
                  </td>
                  <td className="px-2 py-1">
                    {closed || !canSet ? null : (
                      <div className="w-40 [&_label]:sr-only">
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t('setHk')}
                          value={HK.includes(hk as (typeof HK)[number]) ? hk : 'CLEAN'}
                          onChange={(v) => {
                            void setHk(room.id, String(v));
                          }}
                          options={HK.map((code) => ({
                            value: code,
                            label: t(`hkCond.${code}`),
                            disabled: occ && code === 'INSPECTED',
                          }))}
                        />
                      </div>
                    )}
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
        label={t('roomsBoardTitle')}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-[#2C3E50]">{t('roomsBoardTitle')}</h1>
          {headerActions}
        </div>
        <div className="shrink-0">{filters}</div>
        {msg ? <p className="mb-2 rounded-lg bg-white px-4 py-2 text-[13px]">{msg}</p> : null}
        {table}
      </ViewportOverlay>
    );
  }

  return (
    <>
      <PageHeader title={t('roomsBoardTitle')} subtitle={t('roomsBoardHint')} actions={headerActions} />
      {msg ? (
        <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">{msg}</p>
      ) : null}
      {filters}
      {table}
    </>
  );
}
