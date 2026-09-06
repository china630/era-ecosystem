'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { ColorLegend } from '@era/satellite-kit/ui';
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
  PLAN_BAR_OCCUPANCY_STROKE,
  isPlanVisibleRoom,
  type PlanBarDayState,
  type PlanBarOccupancyKind,
} from '@/components/room-plan/plan-bar-theme';
import type {
  RoomPlanGroup,
  RoomPlanReservationBar,
  RoomPlanRoom,
} from '@/components/room-plan/types';

export type {
  ReservationStatus,
  RoomPlanGroup,
  RoomPlanReservationBar,
  RoomPlanRoom,
  RoomStatus,
} from '@/components/room-plan/types';

const ROOM_COL_W = 120;
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

function OccupancySwatch({ stroke }: { stroke: string }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden className="shrink-0">
      <path
        d="M0 0 L12 0 L18 6 L12 12 L0 12 L4 6 Z"
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth="1.6"
      />
    </svg>
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
      <div className="flex items-center gap-1">
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
  onResizeEnd,
  onMoveReservation,
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
  onResizeEnd?: (reservationId: string, newCheckOutIso: string) => void;
  onMoveReservation?: (reservationId: string, toRoomId: string) => void;
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
      onDragOver={(e) => {
        if (!onMoveReservation) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const resId = e.dataTransfer.getData('reservationId');
        if (resId && onMoveReservation) onMoveReservation(resId, room.id);
      }}
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
            key={bar.id}
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
              draggable={Boolean(onResizeEnd || onMoveReservation)}
              roomBars={roomBars}
              onSelect={() => onSelect(selectedId === bar.id ? null : bar.id)}
              onDragStart={(e) => {
                if (!onMoveReservation && !onResizeEnd) return;
                e.dataTransfer.setData('reservationId', bar.id);
              }}
              onDragEnd={(e) => {
                if (!onResizeEnd) return;
                const row = e.currentTarget.parentElement?.parentElement;
                if (!row) return;
                const rect = row.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const dayWidth = rect.width / days;
                const endCol = Math.min(
                  days,
                  Math.max(cell.colStart + 1, Math.round(relX / Math.max(dayWidth, 1))),
                );
                const extraNights = endCol - cell.colStart - cell.span;
                if (extraNights > 0) {
                  const co = parseCalendarDate(bar.checkOutDate);
                  co.setDate(co.getDate() + extraNights);
                  onResizeEnd(bar.id, co.toISOString());
                }
              }}
            />
          </div>
        );
      })}
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
  onResizeEnd,
  onMoveReservation,
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
  onResizeEnd?: (reservationId: string, newCheckOutIso: string) => void;
  onMoveReservation?: (reservationId: string, toRoomId: string) => void;
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
        onResizeEnd={onResizeEnd}
        onMoveReservation={onMoveReservation}
      />
    </>
  );
}

export default function RoomPlanGrid({
  fromIso,
  days,
  rooms,
  reservations,
  availabilityByDay,
  groups,
  selectedId,
  onSelect,
  onResizeEnd,
  onMoveReservation,
  fillViewport = false,
}: {
  fromIso: string;
  days: number;
  rooms: RoomPlanRoom[];
  reservations: RoomPlanReservationBar[];
  availabilityByDay?: Record<string, number>;
  groups?: RoomPlanGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onResizeEnd?: (reservationId: string, newCheckOutIso: string) => void;
  onMoveReservation?: (reservationId: string, toRoomId: string) => void;
  /** When true, grid fills parent height (fullscreen) instead of capping at ~70vh. */
  fillViewport?: boolean;
}) {
  const t = useTranslations('roomPlan');
  const locale = useLocale();
  const from = useMemo(() => parseCalendarDate(fromIso), [fromIso]);
  const [hover, setHover] = useState<HoverCell | null>(null);

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
    swatch: <OccupancySwatch stroke={PLAN_BAR_OCCUPANCY_STROKE[item.id]} />,
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
          onResizeEnd={onResizeEnd}
          onMoveReservation={onMoveReservation}
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
              {avail[d] ?? '—'}
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
              className="pointer-events-none fixed z-[180] rounded-md bg-[#2C3E50] px-2 py-1 text-[11px] font-semibold text-white shadow-md"
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
}
