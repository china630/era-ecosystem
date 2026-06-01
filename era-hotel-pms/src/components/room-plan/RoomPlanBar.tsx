'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { barSvgPath, type BarShapeFlags } from './shapes';
import type { ReservationStatus, RoomPlanReservationBar } from './types';

const ROW_BAR_HEIGHT = 26;

const statusFill: Record<ReservationStatus, string> = {
  CONFIRMED: '#2980B9',
  IN_HOUSE: '#f59e0b',
  OPTION: '#cbd5e1',
  CHECKED_OUT: '#a3a3a3',
  CANCELLED: '#f43f5e',
  NO_SHOW: '#e11d48',
};

const statusStroke: Record<ReservationStatus, string> = {
  CONFIRMED: '#1a5276',
  IN_HOUSE: '#b45309',
  OPTION: '#64748b',
  CHECKED_OUT: '#525252',
  CANCELLED: '#be123c',
  NO_SHOW: '#9f1239',
};

function formatMoney(value: number | string | undefined | null): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

function BarTooltip({
  bar,
  anchor,
}: {
  bar: RoomPlanReservationBar;
  anchor: DOMRect;
}) {
  const t = useTranslations('roomPlan');
  const tRes = useTranslations('reservationStatus');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const left = Math.min(anchor.left, window.innerWidth - 300);
  const top = anchor.bottom + 6;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[200] w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-[#D5DADF] bg-white p-3 text-[12px] leading-snug shadow-lg"
      style={{ left: Math.max(8, left), top }}
    >
      <p className="mb-2 text-[13px] font-semibold text-[#2C3E50]">{bar.guest.fullName}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#34495E]">
        <dt className="text-[#7F8C8D]">{t('tooltipResNo')}</dt>
        <dd>{bar.resNo ?? '—'}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipStatus')}</dt>
        <dd>{tRes(bar.status)}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipCheckIn')}</dt>
        <dd>{bar.checkInDate.slice(0, 10)}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipCheckOut')}</dt>
        <dd>{bar.checkOutDate.slice(0, 10)}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipRoom')}</dt>
        <dd>{bar.room?.roomNumber ?? '—'}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipRoomType')}</dt>
        <dd>{bar.roomType.code}</dd>
        {bar.agency?.name ? (
          <>
            <dt className="text-[#7F8C8D]">{t('tooltipAgency')}</dt>
            <dd>{bar.agency.name}</dd>
          </>
        ) : null}
        {bar.source?.name ? (
          <>
            <dt className="text-[#7F8C8D]">{t('tooltipSource')}</dt>
            <dd>{bar.source.name}</dd>
          </>
        ) : null}
        <dt className="text-[#7F8C8D]">{t('tooltipPayment')}</dt>
        <dd>{bar.paymentMethod ?? '—'}</dd>
        <dt className="text-[#7F8C8D]">{t('tooltipTotal')}</dt>
        <dd>{formatMoney(bar.totalAmount)}</dd>
        {bar.adults != null ? (
          <>
            <dt className="text-[#7F8C8D]">{t('tooltipAdults')}</dt>
            <dd>{bar.adults}</dd>
          </>
        ) : null}
      </dl>
    </div>,
    document.body,
  );
}

export function RoomPlanBar({
  bar,
  shape,
  selected,
  draggable,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  bar: RoomPlanReservationBar;
  shape: BarShapeFlags;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const fill = statusFill[bar.status];
  const stroke = statusStroke[bar.status];
  const textClass = bar.status === 'OPTION' ? 'text-[#34495E]' : 'text-white';

  const showTooltip = useCallback((el: HTMLButtonElement | null) => {
    if (el) setHoverRect(el.getBoundingClientRect());
    else setHoverRect(null);
  }, []);

  return (
    <>
      <button
        type="button"
        draggable={draggable}
        onClick={onSelect}
        onMouseEnter={(e) => showTooltip(e.currentTarget)}
        onMouseLeave={() => showTooltip(null)}
        onFocus={(e) => showTooltip(e.currentTarget)}
        onBlur={() => showTooltip(null)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`relative block h-[26px] w-full overflow-visible p-0 ${
          selected ? 'ring-2 ring-[#2980B9] ring-offset-1' : ''
        }`}
        aria-label={bar.guest.fullName}
      >
        <svg
          className="block h-full w-full overflow-visible"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={barSvgPath(shape)}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className={`pointer-events-none absolute inset-0 flex items-center truncate pl-[14px] pr-2 text-left text-[10px] font-bold ${textClass}`}
        >
          {bar.guest.fullName}
        </span>
      </button>
      {hoverRect ? <BarTooltip bar={bar} anchor={hoverRect} /> : null}
    </>
  );
}
