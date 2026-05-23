'use client';

import { useMemo } from 'react';

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
  CONFIRMED: 'bg-sky-800 border-sky-600',
  IN_HOUSE: 'bg-amber-800 border-amber-600',
  OPTION: 'bg-slate-700 border-slate-500',
  CHECKED_OUT: 'bg-slate-600',
  CANCELLED: 'bg-slate-800',
  NO_SHOW: 'bg-rose-900',
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
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <div className="min-w-max">
        <div className="grid gap-px bg-slate-800 text-xs" style={{ gridTemplateColumns: colTemplate }}>
          <div className="sticky left-0 z-20 bg-slate-900 px-2 py-2 font-medium">Room</div>
          {dateHeaders.map((d) => (
            <div key={d} className="bg-slate-900 px-1 py-2 text-center text-slate-400">
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
                  className={`sticky left-0 z-10 flex flex-col justify-center border-t border-slate-800 px-2 py-2 ${
                    isOoo ? 'bg-slate-800 text-slate-500' : 'bg-slate-950'
                  }`}
                >
                  <span className="font-medium">{room.roomNumber}</span>
                  <span className="text-slate-500">
                    fl.{room.floor} · {room.roomType.code}
                    {isOoo && ` · ${room.status}`}
                  </span>
                </div>
                {cells.map((cell, colIdx) => {
                  if (cell && cell.colStart !== colIdx) {
                    return (
                      <div
                        key={`${room.id}-skip-${colIdx}`}
                        className={`min-h-[44px] border-t border-slate-800 ${isOoo ? 'bg-slate-800/60' : ''}`}
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
                        className={`flex min-h-[44px] items-stretch border-t border-slate-800 p-0.5 ${isOoo ? 'bg-slate-800/60' : 'bg-slate-900/40'}`}
                        style={{ gridColumn: `span ${cell.span}` }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(selected ? null : bar.id)}
                          onDoubleClick={() => window.location.assign(`/folio/${bar.id}`)}
                          className={`w-full truncate rounded border px-1 py-1 text-left text-[10px] ${statusBarStyles[bar.status]} ${selected ? 'ring-2 ring-white' : ''}`}
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
                      className={`min-h-[44px] border-t border-slate-800 ${
                        isOoo ? 'bg-slate-800/60' : 'bg-slate-900/30'
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
