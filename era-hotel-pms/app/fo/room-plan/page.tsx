'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
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
import ReservationCardModal from '@/components/ReservationCardModal';
import { RoomMoveConfirmModal } from '@/components/reservation-card/RoomMoveConfirmModal';
import { doorTypeNeedsSettlement, type ClassSettlement } from '@/lib/room-move-settlement';
import type { RoomMoveReason } from '@/lib/services/room-move-door.service';
import RoomPlanGrid, {
  type RoomPlanGridHandle,
  type RoomPlanGroup,
  type RoomPlanRoom,
  type PlanGestureResult,
} from '@/components/RoomPlanGrid';
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
  roomTypeId?: string;
  givenRoomTypeId?: string | null;
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
  unassigned: Array<ReservationBar & { chipKey?: string; segmentNote?: string }>;
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
  const [cardStayAction, setCardStayAction] = useState<'earlyCheckOut' | null>(null);
  const gridRef = useRef<RoomPlanGridHandle>(null);
  const [busy, setBusy] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    reservationId: string;
    toRoomId: string;
    askReason: boolean;
    askSettlement: boolean;
  } | null>(null);
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

  async function moveReservation(
    reservationId: string,
    toRoomId: string,
    opts?: { reasonCode?: RoomMoveReason; settlement?: ClassSettlement },
  ) {
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: toRoomId,
          ...(opts?.reasonCode ? { reasonCode: opts.reasonCode } : {}),
          ...(opts?.settlement ? { settlement: opts.settlement } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('updateFailed'));
        return;
      }
      showSuccess(json?.pending ? t('movePlanned') : t('moved'));
      setSelectedId(null);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('updateError') });
    } finally {
      setBusy(false);
    }
  }

  async function applyPlanDrop(result: PlanGestureResult) {
    if (result.kind === 'noop') return;
    if (result.kind === 'early-checkout') {
      setCardStayAction('earlyCheckOut');
      setCardReservationId(result.reservationId);
      return;
    }
    if (!can(PERMISSIONS.RESERVATIONS_WRITE)) return;
    setBusy(true);
    try {
      if (result.checkIn || result.checkOut) {
        const res = await fetch(`/api/reservations/${result.reservationId}/schedule`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(result.checkIn ? { checkInDate: result.checkIn } : {}),
            ...(result.checkOut ? { checkOutDate: result.checkOut } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          showApiError(json, tc('updateFailed'));
          return;
        }
      }
      if (result.toRoomId) {
        const stay = data?.reservations.find((row) => row.id === result.reservationId);
        const door = data?.rooms.find((row) => row.id === result.toRoomId);
        const askReason = stay?.status === 'IN_HOUSE';
        const askSettlement = doorTypeNeedsSettlement(
          stay?.roomTypeId,
          stay?.givenRoomTypeId,
          door?.roomTypeId,
        );
        if (askReason || askSettlement) {
          await load();
          setPendingMove({
            reservationId: result.reservationId,
            toRoomId: result.toRoomId,
            askReason,
            askSettlement,
          });
          return;
        }
        await moveReservation(result.reservationId, result.toRoomId);
        return;
      }
      showSuccess(t('datesShifted'));
      await load();
    } catch (error) {
      showApiError({ error: error instanceof Error ? error.message : tc('updateError') });
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
      fillViewport={fullscreen}
      ref={gridRef}
      onSelect={(id) => setSelectedId(id)}
      onOpenReservation={(id) => {
        setCardStayAction(null);
        setCardReservationId(id);
      }}
      onPlanDrop={
        can(PERMISSIONS.RESERVATIONS_WRITE)
          ? (result) => {
              void applyPlanDrop(result);
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
            key={u.chipKey ?? u.id}
            type="button"
            onClick={() => setSelectedId(u.id)}
            onDoubleClick={() => {
              setCardStayAction(null);
              setCardReservationId(u.id);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !can(PERMISSIONS.RESERVATIONS_WRITE)) return;
              gridRef.current?.beginAssign(u, event);
            }}
            className={`rounded-lg border px-2 py-0.5 ${
              selectedId === u.id
                ? 'border-[#2980B9] bg-[#2980B9]/10 text-[#2980B9]'
                : 'border-[#D5DADF] bg-white text-[#34495E]'
            }`}
          >
            {u.guest.fullName}
            {u.segmentNote ? ` · ${u.segmentNote}` : ''}
          </button>
        ))}
      </div>
    ) : null;

  const modals = (
    <>
      <ReservationCardModal
        open={Boolean(cardReservationId)}
        reservationId={cardReservationId}
        initialStayAction={cardStayAction}
        onClose={() => {
          setCardReservationId(null);
          setCardStayAction(null);
          void load();
        }}
      />
      <RoomMoveConfirmModal
        open={Boolean(pendingMove)}
        busy={busy}
        askReason={Boolean(pendingMove?.askReason)}
        askSettlement={Boolean(pendingMove?.askSettlement)}
        onClose={() => setPendingMove(null)}
        onConfirm={(choice) => {
          const move = pendingMove;
          setPendingMove(null);
          if (move) {
            void moveReservation(move.reservationId, move.toRoomId, {
              reasonCode: choice.reason,
              settlement: choice.settlement,
            });
          }
        }}
      />
    </>
  );

  if (fullscreen) {
    return (
      <>
        <div
          className="fixed inset-0 z-[180] flex flex-col bg-[#EBEDF0] px-4 py-3 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('fullscreenTitle')}
        >
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">{headerActions}</div>
          <div className="shrink-0">{filters}</div>
          {unassignedBlock}
          <div className={`${CARD_CONTAINER_CLASS} flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden p-4`}>
            {grid}
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
