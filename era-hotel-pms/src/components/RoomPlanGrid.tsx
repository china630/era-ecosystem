'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ColorLegend } from '@era/satellite-kit/ui';
import { rackNumberTextClass, formatSharePoolBadge } from '@/lib/room-rack-display';
import { RoomPlanBar } from '@/components/room-plan/RoomPlanBar';
import { hoverMarkerLabel } from '@/components/room-plan/format';
import {
  barLayoutOffset,
  calendarDateKey,
  computePlacedBars,
  parseCalendarDate,
} from '@/components/room-plan/shapes';
import type {
  ReservationStatus,
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
const DAY_MIN_W = 52;
const LANE_H = 28;
const ROW_H_BASE = 36;

function rowHeightForRoom(room: RoomPlanRoom, roomBars: RoomPlanReservationBar[]): number {
  const hasShare = roomBars.some((b) => b.shareEligible && b.shareBedIndex != null);
  if (!hasShare) return ROW_H_BASE;
  const lanes = Math.max(room.sharePool?.capacity ?? 2, 1);
  return Math.max(ROW_H_BASE, lanes * LANE_H);
}

const statusSwatch: Record<ReservationStatus, string> = {
  CONFIRMED: 'bg-[#2980B9]',
  IN_HOUSE: 'bg-amber-500',
  OPTION: 'bg-slate-300',
  CHECKED_OUT: 'bg-neutral-400',
  CANCELLED: 'bg-rose-500',
  NO_SHOW: 'bg-rose-600',
};

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

function RoomLabelCell({
  room,
  rowHeight,
  highlighted,
}: {
  room: RoomPlanRoom;
  rowHeight: number;
  highlighted?: boolean;
}) {
  const isOoo = room.status === 'OOO' || room.status === 'OOS';
  const numCls = rackNumberTextClass({
    status: room.status,
    rackDisplayState: undefined,
  });
  const poolBadge = room.sharePool ? formatSharePoolBadge(room.sharePool) : null;
  return (
    <div
      className={`${stickyRoomClass(
        highlighted ? 'bg-[#EBF5FB]' : isOoo ? 'bg-red-50' : 'bg-white',
      )} flex flex-col justify-center border-t border-[#D5DADF] px-2 py-1`}
      style={{ minHeight: rowHeight }}
    >
      <div className="flex items-center gap-1">
        <span className={`text-[13px] font-bold leading-tight ${numCls}`}>{room.roomNumber}</span>
        {poolBadge ? (
          <span className={`text-[10px] font-semibold ${poolBadge.className}`}>{poolBadge.text}</span>
        ) : null}
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
  const isOoo = room.status === 'OOO' || room.status === 'OOS';
  const placed = computePlacedBars(from, days, roomBars);
  const dayBg = isOoo ? 'bg-red-50/80' : 'bg-white';
  const rowHeight = rowHeightForRoom(room, roomBars);
  const laneCount = Math.max(
    1,
    room.sharePool?.capacity ??
      (roomBars.some((b) => b.shareEligible) ? 2 : 1),
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
      {todayIndex != null ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-[1] border-l-2 border-dashed border-amber-500"
          style={{ left: `${(todayIndex / days) * 100}%` }}
        />
      ) : null}
      {placed.map((cell) => {
        const bar = cell.reservation;
        const { leftPct, widthPct } = barLayoutOffset(days, cell);
        const shareLane =
          bar.shareEligible && bar.shareBedIndex != null
            ? Math.max(0, Math.min(laneCount - 1, bar.shareBedIndex - 1))
            : 0;
        const laneHeight = laneCount > 1 ? LANE_H - 2 : rowHeight - 4;
        const topOffset = laneCount > 1 ? shareLane * LANE_H + 1 : 2;
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
}) {
  const t = useTranslations('roomPlan');
  const tRes = useTranslations('reservationStatus');
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

  const avail = availabilityByDay ?? {};
  const cols = `${ROOM_COL_W}px repeat(${days}, minmax(${DAY_MIN_W}px, 1fr))`;
  const minTableW = ROOM_COL_W + days * DAY_MIN_W;

  const legendItems = (Object.keys(statusSwatch) as ReservationStatus[]).map((status) => ({
    id: status,
    label: tRes(status),
    swatchClassName: statusSwatch[status],
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
    <div className="w-full space-y-3">
      <ColorLegend
        ariaLabel={t('legendAria')}
        items={[
          ...legendItems,
          { id: 'ooo', label: t('legendOoo'), swatchClassName: 'bg-red-600' },
          {
            id: 'turnover',
            label: t('legendTurnover'),
            swatchClassName: 'bg-[#2980B9]',
          },
        ]}
      />
      <div className="w-full overflow-x-auto rounded-2xl border border-[#D5DADF] bg-white shadow-sm">
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: cols,
            minWidth: minTableW,
          }}
        >
          <div
            className={`${stickyRoomClass('z-20 bg-[#F8FAFC]')} flex items-center border-b border-[#D5DADF] px-2 text-[13px] font-semibold text-[#34495E]`}
            style={{ minHeight: ROW_H_BASE }}
          >
            {t('roomColumn')}
          </div>
          {dateHeaders.map((d, i) => (
            <div
              key={d}
              className={`flex items-center justify-center border-b border-r border-[#D5DADF]/50 px-1 text-center text-[13px] ${
                hover?.dayIndex === i
                  ? 'bg-[#EBF5FB] font-semibold text-[#2980B9]'
                  : isWeekendKey(d)
                    ? 'bg-[#FDECEC] text-[#C0392B]'
                    : 'bg-[#F8FAFC] text-[#7F8C8D]'
              }`}
              style={{ minHeight: ROW_H_BASE }}
            >
              {d.slice(5)}
            </div>
          ))}

          <div
            className={`${stickyRoomClass('z-20 bg-[#EBF5FB]')} flex items-center border-b border-[#D5DADF] px-2 text-[11px] font-medium text-[#2980B9]`}
            style={{ minHeight: ROW_H_BASE }}
          >
            {t('availability')}
          </div>
          {dateHeaders.map((d) => (
            <div
              key={`avail-${d}`}
              className="flex items-center justify-center border-b border-r border-[#D5DADF]/50 bg-[#EBF5FB] py-1 text-center text-[11px] font-semibold text-[#2980B9]"
              style={{ minHeight: ROW_H_BASE }}
            >
              {avail[d] ?? '—'}
            </div>
          ))}

          {groups
            ? groups.map((g) => (
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
            : renderRoomBlock(rooms)}
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
