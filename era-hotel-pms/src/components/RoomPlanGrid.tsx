'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ColorLegend } from '@era/satellite-kit/ui';
import { RoomPlanBar } from '@/components/room-plan/RoomPlanBar';
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
const ROW_H = 36;

const statusSwatch: Record<ReservationStatus, string> = {
  CONFIRMED: 'bg-[#2980B9]',
  IN_HOUSE: 'bg-amber-500',
  OPTION: 'bg-slate-300',
  CHECKED_OUT: 'bg-neutral-400',
  CANCELLED: 'bg-rose-500',
  NO_SHOW: 'bg-rose-600',
};

function gridCols(days: number): string {
  return `${ROOM_COL_W}px repeat(${days}, minmax(${DAY_MIN_W}px, 1fr))`;
}

function stickyRoomClass(extra = '') {
  return `sticky left-0 z-10 border-r border-[#D5DADF] bg-inherit ${extra}`;
}

function RoomLabelCell({ room }: { room: RoomPlanRoom }) {
  const isOoo = room.status === 'OOO' || room.status === 'OOS';
  return (
    <div
      className={`${stickyRoomClass(isOoo ? 'bg-red-50 text-red-800' : 'bg-white')} flex flex-col justify-center border-t border-[#D5DADF] px-2 py-1`}
      style={{ minHeight: ROW_H }}
    >
      <span className="text-[13px] font-medium leading-tight">{room.roomNumber}</span>
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
  onSelect,
  onResizeEnd,
  onMoveReservation,
}: {
  from: Date;
  days: number;
  room: RoomPlanRoom;
  roomBars: RoomPlanReservationBar[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onResizeEnd?: (reservationId: string, newCheckOutIso: string) => void;
  onMoveReservation?: (reservationId: string, toRoomId: string) => void;
}) {
  const isOoo = room.status === 'OOO' || room.status === 'OOS';
  const placed = computePlacedBars(from, days, roomBars);
  const dayBg = isOoo ? 'bg-red-50/80' : 'bg-white';

  return (
    <div
      className="relative border-t border-[#D5DADF]"
      style={{
        gridColumn: `2 / span ${days}`,
        minHeight: ROW_H,
      }}
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
          <div key={`${room.id}-d-${i}`} className={`border-r border-[#D5DADF]/50 ${dayBg}`} />
        ))}
      </div>
      {placed.map((cell) => {
        const bar = cell.reservation;
        const { leftPct, widthPct } = barLayoutOffset(days, cell);
        return (
          <div
            key={bar.id}
            className="absolute inset-y-0 z-[2] flex items-center py-0.5"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            <RoomPlanBar
              bar={bar}
              shape={{
                turnoverStart: cell.turnoverStart,
                turnoverEnd: cell.turnoverEnd,
                sameDayStay: cell.sameDayStay,
              }}
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
  onSelect,
  onResizeEnd,
  onMoveReservation,
}: {
  from: Date;
  days: number;
  room: RoomPlanRoom;
  barsByRoom: Map<string, RoomPlanReservationBar[]>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onResizeEnd?: (reservationId: string, newCheckOutIso: string) => void;
  onMoveReservation?: (reservationId: string, toRoomId: string) => void;
}) {
  return (
    <>
      <RoomLabelCell room={room} />
      <TimelineCells
        from={from}
        days={days}
        room={room}
        roomBars={barsByRoom.get(room.id) ?? []}
        selectedId={selectedId}
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

  const dateHeaders = useMemo(() => {
    const base = parseCalendarDate(fromIso);
    const headers: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      headers.push(calendarDateKey(d.toISOString()));
    }
    return headers;
  }, [fromIso, days]);

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
  const cols = gridCols(days);
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
            style={{ minHeight: ROW_H }}
          >
            {t('roomColumn')}
          </div>
          {dateHeaders.map((d) => (
            <div
              key={d}
              className="flex items-center justify-center border-b border-r border-[#D5DADF]/50 bg-[#F8FAFC] px-1 text-center text-[13px] text-[#7F8C8D]"
              style={{ minHeight: ROW_H }}
            >
              {d.slice(5)}
            </div>
          ))}

          <div
            className={`${stickyRoomClass('z-20 bg-[#EBF5FB]')} flex items-center border-b border-[#D5DADF] px-2 text-[11px] font-medium text-[#2980B9]`}
            style={{ minHeight: ROW_H }}
          >
            {t('availability')}
          </div>
          {dateHeaders.map((d) => (
            <div
              key={`avail-${d}`}
              className="flex items-center justify-center border-b border-r border-[#D5DADF]/50 bg-[#EBF5FB] py-1 text-center text-[11px] font-semibold text-[#2980B9]"
              style={{ minHeight: ROW_H }}
            >
              {avail[d] ?? '—'}
            </div>
          ))}

          {groups
            ? groups.map((g) => (
                <div key={g.key} className="contents">
                  <div
                    className={`${stickyRoomClass('bg-[#2980B9]/10')} border-t border-[#2980B9]/30 px-2 py-1.5 text-[12px] font-semibold text-[#2980B9]`}
                    style={{ gridColumn: '1 / -1', minHeight: ROW_H }}
                  >
                    {g.label} ({g.roomCount})
                  </div>
                  <div
                    className={`${stickyRoomClass('bg-[#F8FAFC]')} flex items-center border-t border-[#D5DADF] px-2 text-[10px] text-[#7F8C8D]`}
                    style={{ minHeight: ROW_H }}
                  >
                    {t('availability')}
                  </div>
                  {dateHeaders.map((d) => (
                    <div
                      key={`${g.key}-avail-${d}`}
                      className="flex items-center justify-center border-t border-r border-[#D5DADF]/50 bg-[#F8FAFC] text-[10px] font-medium text-[#7F8C8D]"
                      style={{ minHeight: ROW_H }}
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
    </div>
  );
}
