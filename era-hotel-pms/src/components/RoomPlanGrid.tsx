'use client';

import { useMemo } from 'react';
import { DATA_TABLE_VIEWPORT_CLASS } from '@era/satellite-kit/ui';

type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomType: { code: string };
}

interface ReservationBar {
  id: string;
  roomId: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  guest: { fullName: string };
  roomType: { code: string };
}

const statusBarStyles: Record<ReservationStatus, string> = {
  CONFIRMED: 'bg-[#2980B9]/15 border-[#2980B9]/50 text-[#34495E]',
  IN_HOUSE: 'bg-amber-50 border-amber-400/60 text-amber-900',
  OPTION: 'bg-[#F1F5F9] border-[#D5DADF] text-[#7F8C8D]',
  CHECKED_OUT: 'bg-[#EBEDF0] border-[#D5DADF] text-[#7F8C8D]',
  CANCELLED: 'bg-[#F1F5F9] border-[#D5DADF] text-[#7F8C8D]',
  NO_SHOW: 'bg-rose-50 border-rose-400/60 text-rose-800',
};

function parseDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function nightCount(checkIn: Date, checkOut: Date): number {
  return Math.max(1, daysBetween(checkIn, checkOut));
}

interface PlacedBar {
  reservation: ReservationBar;
  colStart: number;
  span: number;
}

function placeBarsForRoom(
  from: Date,
  days: number,
  roomBars: ReservationBar[],
): (PlacedBar | null)[] {
  const cells: (PlacedBar | null)[] = Array(days).fill(null);

  for (const r of roomBars) {
    const ci = parseDay(r.checkInDate);
    const co = parseDay(r.checkOutDate);
    let colStart = daysBetween(from, ci);
    let span = nightCount(ci, co);
    if (colStart < 0) {
      span += colStart;
      colStart = 0;
    }
    if (colStart >= days) continue;
    span = Math.min(span, days - colStart);
    if (span < 1) continue;

    const placed: PlacedBar = { reservation: r, colStart, span };
    if (cells[colStart] === null) {
      cells[colStart] = placed;
      for (let i = 1; i < span; i++) {
        if (colStart + i < days) cells[colStart + i] = placed;
      }
    }
  }
  return cells;
}

export default function RoomPlanGrid({
  fromIso,
  days,
  rooms,
  reservations,
  selectedId,
  onSelect,
}: {
  fromIso: string;
  days: number;
  rooms: Room[];
  reservations: ReservationBar[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const from = useMemo(() => parseDay(fromIso), [fromIso]);

  const dateHeaders = useMemo(() => {
    const headers: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      headers.push(d.toISOString().slice(0, 10));
    }
    return headers;
  }, [from, days]);

  const barsByRoom = useMemo(() => {
    const map = new Map<string, ReservationBar[]>();
    for (const r of reservations) {
      if (!r.roomId) continue;
      const list = map.get(r.roomId) ?? [];
      list.push(r);
      map.set(r.roomId, list);
    }
    return map;
  }, [reservations]);

  const colTemplate = `120px repeat(${days}, minmax(52px, 1fr))`;

  return (
    <div className={DATA_TABLE_VIEWPORT_CLASS}>
      <div className="min-w-max">
        <div className="grid gap-px bg-[#D5DADF] text-xs" style={{ gridTemplateColumns: colTemplate }}>
          <div className="sticky left-0 z-20 bg-[#F8FAFC] px-2 py-2 text-[13px] font-semibold text-[#34495E]">
            Room
          </div>
          {dateHeaders.map((d) => (
            <div key={d} className="bg-[#F8FAFC] px-1 py-2 text-center text-[13px] text-[#7F8C8D]">
              {d.slice(5)}
            </div>
          ))}

          {rooms.map((room) => {
            const isOoo = room.status === 'OOO' || room.status === 'OOS';
            const roomBars = barsByRoom.get(room.id) ?? [];
            const cells = placeBarsForRoom(from, days, roomBars);
            const rendered = new Set<string>();

            return (
              <div key={room.id} className="contents">
                <div
                  className={`sticky left-0 z-10 flex flex-col justify-center border-t border-[#D5DADF] px-2 py-2 ${
                    isOoo ? 'bg-[#EBEDF0] text-[#7F8C8D]' : 'bg-white'
                  }`}
                >
                  <span className="font-medium text-[#34495E]">{room.roomNumber}</span>
                  <span className="text-[#7F8C8D]">
                    fl.{room.floor} · {room.roomType.code}
                    {isOoo && ` · ${room.status}`}
                  </span>
                </div>
                {cells.map((cell, colIdx) => {
                  if (cell && cell.colStart !== colIdx) {
                    return (
                      <div
                        key={`${room.id}-skip-${colIdx}`}
                        className={`min-h-[44px] border-t border-[#D5DADF] ${isOoo ? 'bg-[#EBEDF0]/80' : 'bg-white'}`}
                      />
                    );
                  }
                  if (cell && !rendered.has(cell.reservation.id)) {
                    rendered.add(cell.reservation.id);
                    const bar = cell.reservation;
                    const selected = selectedId === bar.id;
                    return (
                      <div
                        key={`${room.id}-bar-${bar.id}`}
                        className={`flex min-h-[44px] items-stretch border-t border-[#D5DADF] p-0.5 ${isOoo ? 'bg-[#EBEDF0]/80' : 'bg-[#F8FAFC]'}`}
                        style={{ gridColumn: `span ${cell.span}` }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(selected ? null : bar.id)}
                          onDoubleClick={() => window.location.assign(`/folio/${bar.id}`)}
                          className={`w-full truncate rounded-lg border px-1 py-1 text-left text-[10px] ${statusBarStyles[bar.status]} ${selected ? 'ring-2 ring-[#2980B9]' : ''}`}
                          title={`${bar.guest.fullName} — double-click folio`}
                        >
                          {bar.guest.fullName}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${room.id}-empty-${colIdx}`}
                      className={`min-h-[44px] border-t border-[#D5DADF] ${
                        isOoo ? 'bg-[#EBEDF0]/80' : 'bg-white'
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
