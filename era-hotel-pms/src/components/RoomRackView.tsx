'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  FORM_INPUT_CLASS,
  MODAL_CHECKBOX_CLASS,
  SECONDARY_BUTTON_CLASS,
  ColorLegend,
} from '@era/satellite-kit/ui';
import {
  RACK_BORDER_CLASS,
  RACK_SWATCH_CLASS,
  RACK_TEXT_CLASS,
  canQuickBookRoom,
  type RackDisplayState,
} from '@/lib/room-rack-display';

type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OOO'
  | 'OOS'
  | 'MAINTENANCE';

type ReservationStatus =
  | 'OPTION'
  | 'CONFIRMED'
  | 'IN_HOUSE'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type RackPayStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NONE';

export type RoomRackRoom = {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  floor: number;
  roomType: { code: string; name: string };
  reservations: Array<{
    id: string;
    status: ReservationStatus;
    guest: { fullName: string };
    checkInDate?: string;
    checkOutDate?: string;
    payStatus?: RackPayStatus;
    procedureCount?: number;
    procedurePending?: number;
  }>;
  rackDisplayState?: RackDisplayState;
};

function formatStayRange(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
  };
  return `${fmt(checkIn)} – ${fmt(checkOut)}`;
}

const PAY_BADGE: Record<RackPayStatus, string> = {
  PAID: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  UNPAID: 'bg-rose-100 text-rose-800',
  NONE: 'bg-[#EBEDF0] text-[#7F8C8D]',
};

const hkTopBorder: Partial<Record<RoomStatus, string>> = {
  CLEAN: 'border-t-4 border-t-emerald-500',
  INSPECTED: 'border-t-4 border-t-emerald-400',
  DIRTY: 'border-t-4 border-t-[#7F8C8D]',
  OCCUPIED: 'border-t-4 border-t-amber-500',
  AVAILABLE: 'border-t-4 border-t-[#2980B9]',
};

function rackBorder(room: RoomRackRoom): string {
  if (room.rackDisplayState) return RACK_BORDER_CLASS[room.rackDisplayState];
  return hkTopBorder[room.status] ?? 'border-t-4 border-t-[#D5DADF]';
}

function rackText(room: RoomRackRoom): string {
  if (room.rackDisplayState) return RACK_TEXT_CLASS[room.rackDisplayState];
  return 'text-[#34495E]';
}

function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export type RoomRackViewProps = {
  rooms: RoomRackRoom[];
  selectedId: string | null;
  onSelect: (room: RoomRackRoom) => void;
  onQuickBook?: (room: RoomRackRoom) => void;
  onRelocate?: (reservationId: string, toRoomId: string) => Promise<void>;
  loading?: boolean;
};

type ResFilter = 'all' | 'arrival' | 'in_house' | 'departure';

export default function RoomRackView({
  rooms,
  selectedId,
  onSelect,
  onQuickBook,
  onRelocate,
  loading,
}: RoomRackViewProps) {
  const t = useTranslations('roomRack');
  const tRoom = useTranslations('roomStatus');
  const tRes = useTranslations('reservationStatus');
  const tPay = useTranslations('rackPayStatus');
  const [dragResId, setDragResId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [cleanOnly, setCleanOnly] = useState(false);
  const [dirtyOnly, setDirtyOnly] = useState(false);
  const [occupiedOnly, setOccupiedOnly] = useState(false);
  const [vacantOnly, setVacantOnly] = useState(false);
  const [resFilter, setResFilter] = useState<ResFilter>('all');

  const roomTypes = useMemo(() => {
    const codes = new Set(rooms.map((r) => r.roomType.code));
    return Array.from(codes).sort();
  }, [rooms]);

  const floors = useMemo(() => {
    const f = new Set(rooms.map((r) => r.floor));
    return Array.from(f).sort((a, b) => a - b);
  }, [rooms]);

  const filterDay = useMemo(() => dayStart(new Date(filterDate)), [filterDate]);

  const filtered = useMemo(() => {
    return rooms.filter((room) => {
      if (search && !room.roomNumber.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (floorFilter !== 'all' && room.floor !== Number(floorFilter)) return false;
      if (typeFilters.size > 0 && !typeFilters.has(room.roomType.code)) return false;
      if (cleanOnly && !['CLEAN', 'INSPECTED'].includes(room.status)) return false;
      if (dirtyOnly && room.status !== 'DIRTY') return false;
      const isOccupied = room.status === 'OCCUPIED' || room.reservations.some((r) => r.status === 'IN_HOUSE');
      if (occupiedOnly && !isOccupied) return false;
      if (vacantOnly && isOccupied) return false;

      if (resFilter !== 'all') {
        const active =
          room.reservations.find((r) => r.status === 'IN_HOUSE') ?? room.reservations[0];
        if (!active?.checkInDate || !active?.checkOutDate) {
          return false;
        } else {
          const ci = dayStart(new Date(active.checkInDate));
          const co = dayStart(new Date(active.checkOutDate));
          if (resFilter === 'arrival' && !(active.status === 'CONFIRMED' && ci === filterDay)) {
            return false;
          }
          if (resFilter === 'departure' && !(active.status === 'IN_HOUSE' && co === filterDay)) {
            return false;
          }
          if (resFilter === 'in_house' && active.status !== 'IN_HOUSE') return false;
        }
      }
      return true;
    });
  }, [
    rooms,
    search,
    floorFilter,
    typeFilters,
    cleanOnly,
    dirtyOnly,
    occupiedOnly,
    vacantOnly,
    resFilter,
    filterDay,
  ]);

  const occupiedCount = rooms.filter(
    (r) => r.status === 'OCCUPIED' || r.reservations.some((x) => x.status === 'IN_HOUSE'),
  ).length;
  const vacantCount = rooms.length - occupiedCount;

  function toggleType(code: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function resetFilters() {
    setSearch('');
    setFloorFilter('all');
    setTypeFilters(new Set());
    setCleanOnly(false);
    setDirtyOnly(false);
    setOccupiedOnly(false);
    setVacantOnly(false);
    setResFilter('all');
    setFilterDate(new Date().toISOString().slice(0, 10));
  }

  if (loading) {
    return <p className="text-[13px] text-[#7F8C8D]">{t('loading')}</p>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-4">
      <aside className={`${CARD_CONTAINER_CLASS} w-60 shrink-0 space-y-4 p-4 text-[13px]`}>
        <div>
          <label className="mb-1 block font-semibold text-[#34495E]">{t('filterDate')}</label>
          <input
            type="date"
            className={FORM_INPUT_CLASS}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block font-semibold text-[#34495E]">{t('searchRoom')}</label>
          <input
            className={FORM_INPUT_CLASS}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <div className="flex gap-3 text-[12px] text-[#7F8C8D]">
          <span>{t('occupied')}: {occupiedCount}</span>
          <span>{t('vacant')}: {vacantCount}</span>
        </div>
        <div>
          <p className="mb-2 font-semibold text-[#34495E]">{t('reservationFilter')}</p>
          {(['all', 'arrival', 'in_house', 'departure'] as ResFilter[]).map((f) => (
            <label key={f} className="mb-1 flex items-center gap-2">
              <input
                type="radio"
                name="resFilter"
                className={MODAL_CHECKBOX_CLASS}
                checked={resFilter === f}
                onChange={() => setResFilter(f)}
              />
              {t(`resFilter.${f}`)}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-2 font-semibold text-[#34495E]">{t('hkStatus')}</p>
          <label className="mb-1 flex items-center gap-2">
            <input type="checkbox" className={MODAL_CHECKBOX_CLASS} checked={cleanOnly} onChange={(e) => setCleanOnly(e.target.checked)} />
            {t('cleanOnly')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className={MODAL_CHECKBOX_CLASS} checked={dirtyOnly} onChange={(e) => setDirtyOnly(e.target.checked)} />
            {t('dirtyOnly')}
          </label>
        </div>
        <div>
          <p className="mb-2 font-semibold text-[#34495E]">{t('occupancy')}</p>
          <label className="mb-1 flex items-center gap-2">
            <input type="checkbox" className={MODAL_CHECKBOX_CLASS} checked={occupiedOnly} onChange={(e) => setOccupiedOnly(e.target.checked)} />
            {t('occupiedOnly')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className={MODAL_CHECKBOX_CLASS} checked={vacantOnly} onChange={(e) => setVacantOnly(e.target.checked)} />
            {t('vacantOnly')}
          </label>
        </div>
        <div>
          <label className="mb-1 block font-semibold text-[#34495E]">{t('floor')}</label>
          <select className={FORM_INPUT_CLASS} value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
            <option value="all">{t('allFloors')}</option>
            {floors.map((f) => (
              <option key={f} value={String(f)}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-[#34495E]">{t('roomTypes')}</p>
            {typeFilters.size > 0 ? (
              <button type="button" className="text-[11px] text-[#2980B9] hover:underline" onClick={() => setTypeFilters(new Set())}>
                {t('allRoomTypes')}
              </button>
            ) : null}
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {roomTypes.map((code) => (
              <label key={code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={typeFilters.has(code)}
                  onChange={() => toggleType(code)}
                />
                {code}
              </label>
            ))}
          </div>
        </div>
        <button type="button" className={`${SECONDARY_BUTTON_CLASS} w-full text-[12px]`} onClick={resetFilters}>
          {t('resetFilters')}
        </button>
        <p className="text-[11px] text-[#7F8C8D]">{t('forecastDisabled')}</p>
      </aside>

      <div className="min-w-0 flex-1">
        <ColorLegend
          className="mb-3"
          ariaLabel={t('legendAria')}
          items={(
            [
              'vacant',
              'occupied',
              'arrival',
              'departure',
              'cleaning',
              'notReady',
            ] as RackDisplayState[]
          ).map((state) => ({
            id: state,
            label: t(`legend.${state}`),
            swatchClassName: RACK_SWATCH_CLASS[state],
          }))}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((room) => {
            const active = room.reservations.find((r) => r.status === 'IN_HOUSE') ?? room.reservations[0];
            const top = rackBorder(room);
            const textCls = rackText(room);
            const showQuick = onQuickBook && canQuickBookRoom(room);
            const isDropTarget =
              dropTargetId === room.id &&
              Boolean(dragResId) &&
              ['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status);
            return (
              <div
                key={room.id}
                className={`relative rounded-2xl border border-[#D5DADF] bg-white p-3 shadow-sm transition ${top} ${selectedId === room.id ? 'ring-2 ring-[#2980B9]' : ''} ${isDropTarget ? 'ring-2 ring-emerald-500' : ''}`}
                onDragOver={(e) => {
                  if (!dragResId || !onRelocate) return;
                  e.preventDefault();
                  setDropTargetId(room.id);
                }}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const resId = e.dataTransfer.getData('reservationId') || dragResId;
                  setDropTargetId(null);
                  setDragResId(null);
                  if (resId && onRelocate) void onRelocate(resId, room.id);
                }}
              >
                <button type="button" className="w-full text-left" onClick={() => onSelect(room)}>
                  <div className={`text-[11px] font-semibold uppercase ${textCls}`}>
                    {tRoom(room.status)}
                  </div>
                  <div className={`text-xl font-bold ${textCls}`}>{room.roomNumber}</div>
                  <div className="text-[12px] text-[#7F8C8D]">{room.roomType.code}</div>
                  {active ? (
                    <div className="mt-2 space-y-1">
                      <div
                        className="truncate text-[12px] font-medium text-[#34495E]"
                        draggable={Boolean(onRelocate && ['IN_HOUSE', 'CONFIRMED'].includes(active.status))}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragResId(active.id);
                          e.dataTransfer.setData('reservationId', active.id);
                        }}
                        onDragEnd={() => {
                          setDragResId(null);
                          setDropTargetId(null);
                        }}
                        title={onRelocate ? t('dragHint') : undefined}
                      >
                        {active.guest.fullName}
                      </div>
                      {active.checkInDate && active.checkOutDate ? (
                        <div className="text-[11px] text-[#7F8C8D]">
                          {formatStayRange(active.checkInDate, active.checkOutDate)}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1">
                        {active.payStatus ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PAY_BADGE[active.payStatus]}`}
                          >
                            {tPay(active.payStatus)}
                          </span>
                        ) : null}
                        {(active.procedureCount ?? 0) > 0 ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                            {t('procedures', { count: active.procedureCount ?? 0 })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] text-[#7F8C8D]">{t('vacant')}</div>
                  )}
                </button>
                {showQuick ? (
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#2980B9] shadow-sm transition hover:border-[#2980B9]/40 hover:bg-[#EBF5FB]"
                    title={t('quickBook')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickBook(room);
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
