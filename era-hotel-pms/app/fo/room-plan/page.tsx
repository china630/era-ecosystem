'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FilterMenuButton,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal } from '@/components/EraModal';
import ReservationCardModal from '@/components/ReservationCardModal';
import RoomPlanGrid, { type RoomPlanGroup, type RoomPlanRoom } from '@/components/RoomPlanGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesCodeNameQuery } from '@/lib/list-filter';

interface ReservationBar {
  id: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  guest: { fullName: string };
  roomType: { code: string };
}

interface RoomPlanData {
  from: string;
  days: number;
  availabilityByDay: Record<string, number>;
  groups: {
    byType: Array<{
      key: string;
      label: string;
      roomCount: number;
      rooms: RoomPlanRoom[];
      availabilityByDay: Record<string, number>;
    }>;
    byFloor: Array<{
      key: string;
      label: string;
      roomCount: number;
      rooms: RoomPlanRoom[];
      availabilityByDay: Record<string, number>;
    }>;
  };
  rooms: RoomPlanRoom[];
  reservations: ReservationBar[];
  unassigned: ReservationBar[];
}

type GroupMode = 'flat' | 'type' | 'floor';

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function roomMatches(room: RoomPlanRoom, q: string): boolean {
  if (!q.trim()) return true;
  return matchesCodeNameQuery(
    { roomNumber: room.roomNumber, code: room.roomType?.code, name: String(room.floor ?? '') },
    q,
  );
}

function guestMatches(name: string, q: string): boolean {
  if (!q.trim()) return true;
  return matchesCodeNameQuery({ fullName: name }, q);
}

export default function RoomPlanPage() {
  const { can } = useAuth();
  const t = useTranslations('roomPlan');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');
  const [fromDate, setFromDate] = useState(() => bakuYmd());
  const [days, setDays] = useState(14);
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [roomFilter, setRoomFilter] = useState('');
  const [guestFilter, setGuestFilter] = useState('');
  const debouncedRoomFilter = useDebouncedValue(roomFilter, 300);
  const debouncedGuestFilter = useDebouncedValue(guestFilter, 300);
  const [data, setData] = useState<RoomPlanData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardReservationId, setCardReservationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ days: String(days), from: fromDate });
    const res = await fetch(`/api/room-plan?${qs}`);
    const json = await res.json();
    if (res.ok) setData(json);
    else showApiError(json, t('failedLoad'));
  }, [days, fromDate, t]);

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

  const selected = data?.reservations.find((r) => r.id === selectedId)
    ?? data?.unassigned.find((r) => r.id === selectedId);

  const filteredReservations = useMemo(() => {
    if (!data) return [];
    return data.reservations.filter((r) => guestMatches(r.guest.fullName, debouncedGuestFilter));
  }, [data, debouncedGuestFilter]);

  const filteredUnassigned = useMemo(() => {
    if (!data) return [];
    return data.unassigned.filter((r) => guestMatches(r.guest.fullName, debouncedGuestFilter));
  }, [data, debouncedGuestFilter]);

  const guestRoomIds = useMemo(() => {
    if (!debouncedGuestFilter.trim()) return null;
    const ids = new Set<string>();
    for (const r of filteredReservations) {
      if (r.roomId) ids.add(r.roomId);
    }
    return ids;
  }, [filteredReservations, debouncedGuestFilter]);

  const filterRooms = useCallback(
    (rooms: RoomPlanRoom[]) => {
      return rooms.filter((room) => {
        if (!roomMatches(room, debouncedRoomFilter)) return false;
        if (guestRoomIds && !guestRoomIds.has(room.id)) return false;
        return true;
      });
    },
    [debouncedRoomFilter, guestRoomIds],
  );

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    return filterRooms(data.rooms as RoomPlanRoom[]);
  }, [data, filterRooms]);

  const groups: RoomPlanGroup[] | undefined = useMemo(() => {
    if (!data) return undefined;
    const source =
      groupMode === 'type'
        ? data.groups.byType
        : groupMode === 'floor'
          ? data.groups.byFloor
          : undefined;
    if (!source) return undefined;
    return source
      .map((g) => {
        const rooms = filterRooms(g.rooms as RoomPlanRoom[]);
        return {
          ...g,
          rooms,
          roomCount: rooms.length,
        };
      })
      .filter((g) => g.rooms.length > 0) as RoomPlanGroup[];
  }, [data, groupMode, filterRooms]);

  async function moveReservation(reservationId: string, toRoomId: string) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: toRoomId }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('updateFailed'));
        return;
      }
      showSuccess(t('moved'));
      setSelectedId(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('updateError') });
    } finally {
      setBusy(false);
    }
  }

  async function extendNights(n: number) {
    if (!selected) return;
    setBusy(true);
    try {
      const checkOut = new Date(selected.checkOutDate);
      checkOut.setDate(checkOut.getDate() + n);
      const res = await fetch(`/api/reservations/${selected.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkOutDate: checkOut.toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('updateFailed'));
        return;
      }
      showSuccess(t('extendTo', { date: checkOut.toISOString().slice(0, 10) }));
      setSelectedId(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('updateError') });
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionRoomPlan')}</p>;
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterMenuButton
        label={t('groupingLabel')}
        value={groupMode}
        options={[
          { value: 'type', label: t('groupByType') },
          { value: 'floor', label: t('groupByFloor') },
          { value: 'flat', label: t('groupFlat') },
        ]}
        onChange={(v) => setGroupMode(v as GroupMode)}
      />
      <FilterMenuButton
        label={t('periodLabel')}
        value={String(days)}
        options={[
          { value: '14', label: t('days', { count: 14 }) },
          { value: '21', label: t('days', { count: 21 }) },
          { value: '30', label: t('days', { count: 30 }) },
        ]}
        onChange={(v) => setDays(Number(v))}
      />
      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => window.print()}>
        {t('print')}
      </button>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => setFullscreen((v) => !v)}
      >
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
        setRoomFilter('');
        setGuestFilter('');
      }}
      actionsExtra={
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {t('refresh')}
        </button>
      }
    >
      <DatePicker
        label={t('filterDate')}
        value={fromDate}
        onChange={setFromDate}
        placeholder={tc('datePlaceholder')}
        openCalendarLabel={tc('openCalendar')}
        fluid
      />
      <Field
        label={t('filterRoom')}
        preset="shortText"
        value={roomFilter}
        onChange={(e) => setRoomFilter(e.target.value)}
        placeholder={t('filterRoomPlaceholder')}
      />
      <Field
        label={t('filterGuest')}
        preset="shortText"
        value={guestFilter}
        onChange={(e) => setGuestFilter(e.target.value)}
        placeholder={t('filterGuestPlaceholder')}
      />
    </EraListFilterBar>
  );

  const grid = data ? (
    <RoomPlanGrid
      fromIso={data.from}
      days={data.days}
      rooms={filteredRooms as never}
      reservations={filteredReservations as never}
      availabilityByDay={data.availabilityByDay}
      groups={groups}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id);
        if (id) setCardReservationId(id);
      }}
      onMoveReservation={
        can(PERMISSIONS.RESERVATIONS_WRITE)
          ? (reservationId, toRoomId) => moveReservation(reservationId, toRoomId)
          : undefined
      }
      onResizeEnd={
        can(PERMISSIONS.RESERVATIONS_WRITE)
          ? async (reservationId, newCheckOutIso) => {
              setBusy(true);
              try {
                const res = await fetch(`/api/reservations/${reservationId}/schedule`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ checkOutDate: newCheckOutIso }),
                });
                const json = await res.json();
                if (!res.ok) {
                  showApiError(json, tc('updateFailed'));
                  return;
                }
                showSuccess(t('extendTo', { date: newCheckOutIso.slice(0, 10) }));
                await load();
              } catch (e) {
                showApiError({ error: e instanceof Error ? e.message : tc('updateError') });
              } finally {
                setBusy(false);
              }
            }
          : undefined
      }
    />
  ) : null;

  const unassignedBlock =
    filteredUnassigned.length > 0 ? (
      <div className="mb-2 flex flex-wrap gap-2 text-[13px]">
        <span className="text-amber-800">{t('unassigned')}</span>
        {filteredUnassigned.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSelectedId(u.id)}
            className={`rounded-lg border px-2 py-0.5 ${
              selectedId === u.id
                ? 'border-[#2980B9] bg-[#2980B9]/10 text-[#2980B9]'
                : 'border-[#D5DADF] bg-white text-[#34495E]'
            }`}
          >
            {u.guest.fullName}
          </button>
        ))}
      </div>
    ) : null;

  const modals = (
    <>
      {selected && can(PERMISSIONS.RESERVATIONS_WRITE) && (
        <EraModal
          open={!!selectedId}
          title={selected.guest.fullName}
          subtitle={`${tRes(selected.status as 'CONFIRMED')} · ${selected.checkInDate.slice(0, 10)} → ${selected.checkOutDate.slice(0, 10)}`}
          onClose={() => setSelectedId(null)}
        >
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#34495E]">
            <button type="button" disabled={busy} onClick={() => extendNights(1)} className={SECONDARY_BUTTON_CLASS}>
              {t('plusOneNight')}
            </button>
            <button type="button" disabled={busy} onClick={() => extendNights(2)} className={SECONDARY_BUTTON_CLASS}>
              {t('plusTwoNights')}
            </button>
            <button
              type="button"
              className="text-[#2980B9] hover:underline"
              onClick={() => {
                setCardReservationId(selected.id);
                setSelectedId(null);
              }}
            >
              {t('openCard')}
            </button>
            <Link href={`/folio/${selected.id}`} className="text-[#2980B9] hover:underline">
              {t('folio')}
            </Link>
          </div>
        </EraModal>
      )}

      <ReservationCardModal
        open={Boolean(cardReservationId)}
        reservationId={cardReservationId}
        onClose={() => {
          setCardReservationId(null);
          void load();
        }}
      />
    </>
  );

  if (fullscreen) {
    return (
      <>
        <div
          className="fixed inset-0 z-[180] flex flex-col bg-[#EBEDF0]"
          role="dialog"
          aria-modal="true"
          aria-label={t('fullscreenTitle')}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D5DADF] bg-white px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h2 className="m-0 truncate text-lg font-semibold text-[#34495E]">{t('fullscreenTitle')}</h2>
              <p className="m-0 truncate text-[13px] text-[#7F8C8D]">
                {fromDate} · {t('days', { count: days })}
              </p>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setFullscreen(false)}
              aria-label={t('exitFullscreen')}
            >
              <X className="h-4 w-4" aria-hidden />
              {t('exitFullscreen')}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{headerActions}</div>
            {filters}
            {unassignedBlock}
            <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>{grid}</div>
          </div>
        </div>
        {modals}
      </>
    );
  }

  return (
    <div className="min-w-0 w-full">
      <PageHeader title={t('title')} actions={headerActions} />
      {filters}
      {unassignedBlock}
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>{grid}</div>
      {modals}
    </div>
  );
}
