'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { ColorLegend } from '@era/satellite-kit/ui';
import { HkStatusBar } from '@/components/HkStatusMark';
import { rackNumberTextClass } from '@/lib/room-rack-display';
import { RoomPlanBar } from '@/components/room-plan/RoomPlanBar';
import { hoverMarkerLabel, planHeaderParts } from '@/components/room-plan/format';
import {
  barLayoutOffset,
  calendarDateKey,
  computePlacedBars,
  parseCalendarDate,
} from '@/components/room-plan/shapes';
import {
  assignSharePaintLanes,
  shareLaneCount,
  toShareLaneInput,
} from '@/components/room-plan/share-lanes';
import {
  PLAN_BAR_COLORS,
  PLAN_BAR_OCCUPANCY_MARK,
  isPlanVisibleRoom,
  occupancyMarkLabel,
  type PlanBarDayState,
  type PlanBarOccupancyKind,
} from '@/components/room-plan/plan-bar-theme';
import { commitPlanGesture, type PlanGestureResult } from '@/components/room-plan/plan-gesture';
import type {
  RoomPlanGroup,
  RoomPlanReservationBar,
  RoomPlanRoom,
} from '@/components/room-plan/types';

export type { PlanGestureResult };

type PlanDragSession = {
  reservationId: string;
  status: string;
  mode: 'move' | 'start' | 'end' | 'assign';
  fromRoomId: string | null;
  checkIn: string;
  checkOut: string;
  /** Column under the pointer when the drag started. */
  startCol: number;
  /** Left column of the bar, independent of where the pointer grabbed it. */
  barCol: number;
  barSpan: number;
  lastCol: number;
  lastRoomId: string | null;
  x: number;
  y: number;
};

function columnAt(clientX: number, row: HTMLElement, dayCount: number): number {
  const rect = row.getBoundingClientRect();
  const width = rect.width / dayCount;
  return Math.max(0, Math.min(dayCount - 1, Math.floor((clientX - rect.left) / Math.max(width, 1))));
}

export type {
  ReservationStatus,
  RoomPlanGroup,
  RoomPlanReservationBar,
  RoomPlanRoom,
  RoomStatus,
} from '@/components/room-plan/types';

const ROOM_COL_W = 136;
const DAY_MIN_W = 56;
const ROW_H_BASE = 36;
const DATE_HEADER_H = 44;
const AVAIL_ROW_H = 28;
const BAR_GUTTER = 2;

function rowHeightForRoom(room: RoomPlanRoom, roomBars: RoomPlanReservationBar[]): number {
  const lanes = shareLaneCount(
    roomBars.map(toShareLaneInput),
    room.sharePool?.capacity ?? 2,
  );
  return lanes * ROW_H_BASE;
}

const BAR_LEGEND_STATES: PlanBarDayState[] = [
  'reservation',
  'expectedArrival',
  'inHouse',
  'expectedDeparture',
  'checkout',
  'multiple',
  'option',
];

function ChevronSwatch({ fill }: { fill: string }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden className="shrink-0">
      <path
        d="M0 0 L12 0 L18 6 L12 12 L0 12 L4 6 Z"
        fill={fill}
        stroke="#D5DADF"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function OccupancySwatch({ kind }: { kind: PlanBarOccupancyKind }) {
  const mark = PLAN_BAR_OCCUPANCY_MARK[kind];
  if (kind === 'exclusive') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden className="shrink-0">
        <path
          d="M0 0 L12 0 L18 6 L12 12 L0 12 L4 6 Z"
          fill="#8BC34A"
          stroke="#D5DADF"
          strokeWidth="0.5"
        />
      </svg>
    );
  }
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-black leading-none text-white"
      style={{ backgroundColor: mark }}
      aria-hidden
    >
      {occupancyMarkLabel(kind)}
    </span>
  );
}

type HoverCell = {
  roomId: string;
  roomNumber: string;
  dayIndex: number;
  clientX: number;
  clientY: number;
};

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isWeekendKey(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

function dayIndexFromMouse(e: React.MouseEvent<HTMLElement>, days: number): number | null {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (rect.width <= 0 || x < 0 || x > rect.width) return null;
  return Math.max(0, Math.min(days - 1, Math.floor((x / rect.width) * days)));
}

function stickyRoomClass(extra = '') {
  return `sticky left-0 z-10 border-r border-[#D5DADF] bg-inherit ${extra}`;
}

function stickyDateHeaderClass(extra = '') {
  return `sticky top-0 z-30 border-b border-r border-[#D5DADF]/50 ${extra}`;
}

function stickyAvailHeaderClass(extra = '') {
  return `sticky z-20 border-b border-r border-[#D5DADF]/50 ${extra}`;
}

function RoomLabelCell({
  room,
  rowHeight,
  highlighted,
}: {
  room: RoomPlanRoom;
  rowHeight: number;
  highlighted?: boolean;
}) {
  const numCls = rackNumberTextClass({
    status: room.status,
    rackDisplayState: undefined,
  });
  return (
    <div
      className={`${stickyRoomClass(
        highlighted ? 'bg-[#EBF5FB]' : 'bg-white',
      )} flex flex-col justify-center border-t border-[#D5DADF] px-2 py-1`}
      style={{ minHeight: rowHeight }}
    >
      <div className="flex items-center gap-1.5">
        <HkStatusBar status={room.hkCondition ?? room.status} />
        <span className={`text-[13px] font-bold leading-tight ${numCls}`}>{room.roomNumber}</span>
      </div>
      <span className="text-[10px] leading-tight text-[#7F8C8D]">
        fl.{room.floor} · {room.roomType.code}
      </span>
    </div>
  );
}

function TimelineCells({
  from,
  days,
  room,
  roomBars,
  selectedId,
  hoverDayIndex,
  todayIndex,
  onHover,
  onSelect,
  onOpen,
  beginDrag,
  swallowClick,
  preview,
}: {
  from: Date;
  days: number;
  room: RoomPlanRoom;
  roomBars: RoomPlanReservationBar[];
  selectedId: string | null;
  hoverDayIndex: number | null;
  todayIndex: number | null;
  onHover: (dayIndex: number | null, clientX: number, clientY: number) => void;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  beginDrag: (session: PlanDragSession) => void;
  swallowClick: MutableRefObject<boolean>;
  preview: { roomId: string; leftPct: number; widthPct: number } | null;
}) {
  const placed = computePlacedBars(from, days, roomBars);
  const dayBg = 'bg-white';
  const laneCount = shareLaneCount(
    roomBars.map(toShareLaneInput),
    room.sharePool?.capacity ?? 2,
  );
  const rowHeight = laneCount * ROW_H_BASE;
  const paintLanes = assignSharePaintLanes(
    roomBars.map(toShareLaneInput),
    room.sharePool?.capacity ?? 2,
  );

  return (
    <div
      className="relative border-t border-[#D5DADF]"
      style={{
        gridColumn: `2 / span ${days}`,
        minHeight: rowHeight,
      }}
      onMouseMove={(e) => {
        const idx = dayIndexFromMouse(e, days);
        onHover(idx, e.clientX, e.clientY);
      }}
      onMouseLeave={() => onHover(null, 0, 0)}
      data-plan-room={room.id}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${days}, minmax(${DAY_MIN_W}px, 1fr))` }}
      >
        {Array.from({ length: days }, (_, i) => (
          <div
            key={`${room.id}-d-${i}`}
            className={`border-r border-[#D5DADF]/50 ${
              hoverDayIndex === i ? 'bg-[#2980B9]/10' : dayBg
            }`}
          />
        ))}
      </div>
      {laneCount > 1
        ? Array.from({ length: laneCount - 1 }, (_, i) => (
            <div
              key={`hair-${room.id}-${i}`}
              className="pointer-events-none absolute inset-x-0 z-[1] border-t border-[#D5DADF]"
              style={{ top: (i + 1) * ROW_H_BASE }}
            />
          ))
        : null}
      {todayIndex != null ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-[1] border-l-2 border-dashed border-amber-500"
          style={{ left: `${(todayIndex / days) * 100}%` }}
        />
      ) : null}
      {placed.map((cell) => {
        const bar = cell.reservation;
        const { leftPct, widthPct } = barLayoutOffset(days, cell);
        const shareLane = paintLanes.get(bar.id) ?? 0;
        const laneHeight = ROW_H_BASE - BAR_GUTTER * 2;
        const topOffset = shareLane * ROW_H_BASE + BAR_GUTTER;
        return (
          <div
            key={bar.barKey ?? bar.id}
            className="absolute z-[2] flex items-center"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              top: topOffset,
              height: laneHeight,
            }}
          >
            <RoomPlanBar
              bar={bar}
              shape={cell.shape}
              selected={selectedId === bar.id}
              roomBars={roomBars}
              onSelect={() => {
                if (swallowClick.current) {
                  swallowClick.current = false;
                  return;
                }
                onSelect(bar.id);
              }}
              onOpen={() => onOpen(bar.id)}
              onPointerDown={(event, mode) => {
                const row = event.currentTarget.closest('[data-plan-room]') as HTMLElement | null;
                const startCol = row ? columnAt(event.clientX, row, days) : cell.colStart;
                beginDrag({
                  reservationId: bar.id,
                  status: bar.status,
                  mode,
                  fromRoomId: room.id,
                  checkIn: bar.checkInDate,
                  checkOut: bar.checkOutDate,
                  startCol,
                  barCol: cell.colStart,
                  barSpan: cell.span,
                  lastCol: startCol,
                  lastRoomId: room.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            />
          </div>
        );
      })}
      {preview && preview.roomId === room.id ? (
        <div
          className="pointer-events-none absolute z-[3] rounded-sm bg-[#2980B9]/30"
          style={{ left: `${preview.leftPct}%`, width: `${preview.widthPct}%`, top: 4, height: 26 }}
        />
      ) : null}
    </div>
  );
}

function RoomRow({
  from,
  days,
  room,
  barsByRoom,
  selectedId,
  hoverDayIndex,
  hoverRoomId,
  todayIndex,
  onHover,
  onSelect,
  onOpen,
  beginDrag,
  swallowClick,
  preview,
}: {
  from: Date;
  days: number;
  room: RoomPlanRoom;
  barsByRoom: Map<string, RoomPlanReservationBar[]>;
  selectedId: string | null;
  hoverDayIndex: number | null;
  hoverRoomId: string | null;
  todayIndex: number | null;
  onHover: (dayIndex: number | null, clientX: number, clientY: number) => void;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  beginDrag: (session: PlanDragSession) => void;
  swallowClick: MutableRefObject<boolean>;
  preview: { roomId: string; leftPct: number; widthPct: number } | null;
}) {
  const roomBars = barsByRoom.get(room.id) ?? [];
  const rowHeight = rowHeightForRoom(room, roomBars);
  return (
    <>
      <RoomLabelCell
        room={room}
        rowHeight={rowHeight}
        highlighted={hoverRoomId === room.id}
      />
      <TimelineCells
        from={from}
        days={days}
        room={room}
        roomBars={roomBars}
        selectedId={selectedId}
        hoverDayIndex={hoverDayIndex}
        todayIndex={todayIndex}
        onHover={onHover}
        onSelect={onSelect}
        onOpen={onOpen}
        beginDrag={beginDrag}
        swallowClick={swallowClick}
        preview={preview}
      />
    </>
  );
}

export type RoomPlanGridHandle = {
  beginAssign: (stay: {
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
  }, event: { clientX: number; clientY: number }) => void;
};

const RoomPlanGrid = forwardRef<
  RoomPlanGridHandle,
  {
    fromIso: string;
    days: number;
    rooms: RoomPlanRoom[];
    reservations: RoomPlanReservationBar[];
    availabilityByDay?: Record<string, number>;
    groups?: RoomPlanGroup[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onOpenReservation?: (id: string) => void;
    onPlanDrop?: (result: PlanGestureResult) => void;
    fillViewport?: boolean;
  }
>(function RoomPlanGrid(
  {
    fromIso,
    days,
    rooms,
    reservations,
    availabilityByDay,
    groups,
    selectedId,
    onSelect,
    onOpenReservation,
    onPlanDrop,
    fillViewport = false,
  },
  ref,
) {
  const t = useTranslations('roomPlan');
  const locale = useLocale();
  const from = useMemo(() => parseCalendarDate(fromIso), [fromIso]);
  const [hover, setHover] = useState<HoverCell | null>(null);
  const dragRef = useRef<PlanDragSession | null>(null);
  const movedRef = useRef(false);
  const [preview, setPreview] = useState<{ roomId: string; leftPct: number; widthPct: number } | null>(null);

  const beginDrag = useCallback((session: PlanDragSession) => {
    dragRef.current = session;
    movedRef.current = false;
  }, []);

  useImperativeHandle(ref, () => ({
    beginAssign(stay, event) {
      const nights = Math.max(
        1,
        Math.round(
          (parseCalendarDate(stay.checkOutDate).getTime() - parseCalendarDate(stay.checkInDate).getTime()) /
            86400000,
        ),
      );
      beginDrag({
        reservationId: stay.id,
        status: stay.status,
        mode: 'assign',
        fromRoomId: null,
        checkIn: stay.checkInDate,
        checkOut: stay.checkOutDate,
        startCol: 0,
        barCol: 0,
        barSpan: nights,
        lastCol: 0,
        lastRoomId: null,
        x: event.clientX,
        y: event.clientY,
      });
    },
  }), [beginDrag]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) < 6) return;
      movedRef.current = true;
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-plan-room]') as HTMLElement | null;
      if (!row) {
        setPreview(null);
        return;
      }
      const roomId = row.getAttribute('data-plan-room') ?? '';
      const col = columnAt(event.clientX, row, days);
      drag.lastCol = col;
      drag.lastRoomId = roomId;
      const delta = drag.mode === 'assign' ? 0 : col - drag.startCol;
      const inHouse = drag.status === 'IN_HOUSE';
      const holdDates = inHouse && (drag.mode === 'move' || drag.mode === 'start');
      let start = drag.barCol;
      let span = drag.barSpan;
      if (drag.mode === 'assign') {
        start = col;
        span = drag.barSpan;
      } else if (!holdDates && drag.mode === 'end') {
        span = Math.max(1, drag.barSpan + delta);
      } else if (!holdDates && drag.mode === 'start') {
        span = Math.max(1, drag.barSpan - delta);
        start = drag.barCol + drag.barSpan - span;
      } else if (!holdDates) {
        start = drag.barCol + delta;
      }
      setPreview({
        roomId,
        leftPct: (Math.max(0, start) / days) * 100,
        widthPct: (Math.max(1, span) / days) * 100,
      });
    }
    function onUp(event: PointerEvent) {
      const drag = dragRef.current;
      dragRef.current = null;
      setPreview(null);
      if (!drag || !movedRef.current) return;
      movedRef.current = true;
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-plan-room]') as HTMLElement | null;
      const roomId = row?.getAttribute('data-plan-room') ?? drag.lastRoomId;
      const col = row ? columnAt(event.clientX, row, days) : drag.lastCol;
      const gridFrom = parseCalendarDate(fromIso);
      gridFrom.setUTCDate(gridFrom.getUTCDate() + col);
      const result = commitPlanGesture({
        reservationId: drag.reservationId,
        status: drag.status,
        mode: drag.mode,
        deltaDays: col - drag.startCol,
        fromRoomId: drag.fromRoomId,
        toRoomId: roomId,
        checkIn: drag.checkIn,
        checkOut: drag.checkOut,
        assignCheckIn: drag.mode === 'assign' ? gridFrom.toISOString() : null,
      });
      if (result.kind !== 'noop') onPlanDrop?.(result);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [days, fromIso, onPlanDrop]);

  const dateHeaders = useMemo(() => {
    const base = parseCalendarDate(fromIso);
    const headers: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      headers.push(calendarDateKey(d.toISOString()));
    }
    return headers;
  }, [fromIso, days]);

  const todayIndex = useMemo(() => {
    const idx = dateHeaders.indexOf(bakuYmd());
    return idx >= 0 ? idx : null;
  }, [dateHeaders]);

  const barsByRoom = useMemo(() => {
    const map = new Map<string, RoomPlanReservationBar[]>();
    for (const r of reservations) {
      if (!r.roomId) continue;
      const list = map.get(r.roomId) ?? [];
      list.push(r);
      map.set(r.roomId, list);
    }
    return map;
  }, [reservations]);

  const visibleRooms = useMemo(() => rooms.filter(isPlanVisibleRoom), [rooms]);
  const visibleGroups = useMemo(
    () =>
      groups
        ?.map((g) => {
          const list = g.rooms.filter(isPlanVisibleRoom);
          return { ...g, rooms: list, roomCount: list.length };
        })
        .filter((g) => g.roomCount > 0),
    [groups],
  );
  const cols = `${ROOM_COL_W}px repeat(${days}, minmax(${DAY_MIN_W}px, 1fr))`;
  const minTableW = ROOM_COL_W + days * DAY_MIN_W;

  const barLegendItems = BAR_LEGEND_STATES.map((state) => ({
    id: state,
    label: t(
      state === 'expectedArrival'
        ? 'legendExpectedArrival'
        : state === 'expectedDeparture'
          ? 'legendExpectedDeparture'
          : state === 'inHouse'
            ? 'legendInHouse'
            : state === 'checkout'
              ? 'legendCheckout'
              : state === 'multiple'
                ? 'legendMultiple'
                : state === 'option'
                  ? 'legendOption'
                  : 'legendReservation',
    ),
    swatchClassName: '',
    swatch: <ChevronSwatch fill={PLAN_BAR_COLORS[state].fill} />,
  }));

  const occupancyLegendItems = (
    [
      { id: 'exclusive' as const, label: t('legendOccupancyExclusive') },
      { id: 'shareM' as const, label: t('legendOccupancyShareM') },
      { id: 'shareF' as const, label: t('legendOccupancyShareF') },
    ] satisfies { id: PlanBarOccupancyKind; label: string }[]
  ).map((item) => ({
    id: item.id,
    label: item.label,
    swatchClassName: '',
    swatch: <OccupancySwatch kind={item.id} />,
  }));

  const renderRoomBlock = (roomList: RoomPlanRoom[]) =>
    roomList.map((room) => (
      <div key={room.id} className="contents">
        <RoomRow
          from={from}
          days={days}
          room={room}
          barsByRoom={barsByRoom}
          selectedId={selectedId}
          hoverDayIndex={hover?.dayIndex ?? null}
          hoverRoomId={hover?.roomId ?? null}
          todayIndex={todayIndex}
          onHover={(dayIndex, clientX, clientY) => {
            if (dayIndex == null) {
              setHover(null);
              return;
            }
            setHover({
              roomId: room.id,
              roomNumber: room.roomNumber,
              dayIndex,
              clientX,
              clientY,
            });
          }}
          onSelect={onSelect}
          onOpen={(id) => onOpenReservation?.(id)}
          beginDrag={beginDrag}
          swallowClick={movedRef}
          preview={preview}
        />
      </div>
    ));

  return (
    <div
      className={`w-full space-y-3 ${fillViewport ? 'flex min-h-0 flex-1 flex-col' : ''}`}
    >
      <div className={`space-y-1.5 ${fillViewport ? 'shrink-0' : ''}`}>
        <ColorLegend ariaLabel={t('legendBarsAria')} items={barLegendItems} />
        <ColorLegend ariaLabel={t('legendOccupancyAria')} items={occupancyLegendItems} />
      </div>
      <div
        className={`w-full overflow-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm ${
          fillViewport ? 'min-h-0 flex-1' : 'max-h-[min(70vh,calc(100vh-13rem))]'
        }`}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: cols,
            minWidth: minTableW,
          }}
        >
          <div
            className={`${stickyRoomClass('top-0 z-40 bg-[#F8FAFC]')} flex items-center border-b border-[#D5DADF] px-2 text-[13px] font-semibold text-[#34495E]`}
            style={{ minHeight: DATE_HEADER_H }}
          >
            {t('roomColumn')}
          </div>
          {dateHeaders.map((d, i) => {
            const { day, weekday } = planHeaderParts(d, locale);
            return (
            <div
              key={d}
              className={`${stickyDateHeaderClass(
                hover?.dayIndex === i
                  ? 'bg-[#EBF5FB] font-semibold text-[#2980B9]'
                  : isWeekendKey(d)
                    ? 'bg-[#FDECEC] text-[#C0392B]'
                    : 'bg-[#F8FAFC] text-[#34495E]',
              )} flex flex-col items-center justify-center px-1 py-0.5 text-center leading-tight`}
              style={{ minHeight: DATE_HEADER_H }}
            >
              <span className="text-[16px] font-bold">{day}</span>
              <span
                className={`text-[10px] font-medium ${
                  isWeekendKey(d) && hover?.dayIndex !== i ? 'text-[#C0392B]' : 'text-[#7F8C8D]'
                }`}
              >
                {weekday}
              </span>
            </div>
            );
          })}

          <div
            className={`${stickyRoomClass('z-40 bg-[#EBF5FB]')} flex items-center border-b border-[#D5DADF] px-2 text-[11px] font-medium text-[#2980B9]`}
            style={{ minHeight: AVAIL_ROW_H, top: DATE_HEADER_H }}
          >
            {t('availability')}
          </div>
          {dateHeaders.map((d) => (
            <div
              key={`avail-${d}`}
              className={`${stickyAvailHeaderClass('bg-[#EBF5FB]')} flex items-center justify-center py-1 text-center text-[11px] font-semibold text-[#2980B9]`}
              style={{ minHeight: AVAIL_ROW_H, top: DATE_HEADER_H }}
            >
              {availabilityByDay?.[d] ?? '—'}
            </div>
          ))}

          {visibleGroups
            ? visibleGroups.map((g) => (
                <div key={g.key} className="contents">
                  <div
                    className={`${stickyRoomClass('bg-[#2980B9]/10')} border-t border-[#2980B9]/30 px-2 py-1.5 text-[12px] font-semibold text-[#2980B9]`}
                    style={{ gridColumn: '1 / -1', minHeight: ROW_H_BASE }}
                  >
                    {g.label} ({g.roomCount})
                  </div>
                  <div
                    className={`${stickyRoomClass('bg-[#F8FAFC]')} flex items-center border-t border-[#D5DADF] px-2 text-[10px] text-[#7F8C8D]`}
                    style={{ minHeight: ROW_H_BASE }}
                  >
                    {t('availability')}
                  </div>
                  {dateHeaders.map((d) => (
                    <div
                      key={`${g.key}-avail-${d}`}
                      className="flex items-center justify-center border-t border-r border-[#D5DADF]/50 bg-[#F8FAFC] text-[10px] font-medium text-[#7F8C8D]"
                      style={{ minHeight: ROW_H_BASE }}
                    >
                      {g.availabilityByDay[d] ?? '—'}
                    </div>
                  ))}
                  {renderRoomBlock(g.rooms)}
                </div>
              ))
            : renderRoomBlock(visibleRooms)}
        </div>
      </div>
      {hover && dateHeaders[hover.dayIndex]
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[190] rounded-md bg-[#2C3E50] px-2 py-1 text-[11px] font-semibold text-white shadow-md"
              style={{
                left: Math.min(hover.clientX + 12, window.innerWidth - 140),
                top: hover.clientY + 14,
              }}
            >
              {hoverMarkerLabel(hover.roomNumber, dateHeaders[hover.dayIndex]!)}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
});

export default RoomPlanGrid;
