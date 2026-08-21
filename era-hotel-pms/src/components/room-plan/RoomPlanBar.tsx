'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { formatPax, formatPlanDate } from './format';
import { barSvgPath, type BarShapeFlags } from './shapes';
import type { ReservationStatus, RoomPlanReservationBar } from './types';

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
  return Number.isFinite(n) ? `${n.toFixed(2)} AZN` : String(value);
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <>
      <dt className="text-[#7F8C8D]">{label}</dt>
      <dd className="min-w-0 break-words text-[#34495E]">{value}</dd>
    </>
  );
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

  const left = Math.min(anchor.left, window.innerWidth - 340);
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 280);
  const pax = formatPax(bar.adults, bar.children11_6, bar.children5_2, bar.children1_0);
  const stay = `${formatPlanDate(bar.checkInDate)} – ${formatPlanDate(bar.checkOutDate)}`;
  const meal = bar.mealPlanCode ? ` (${bar.mealPlanCode})` : '';
  const shareLabel =
    bar.shareEligible && bar.shareBedIndex != null
      ? `${bar.shareGender === 'F' || (bar.shareGender ?? '').toUpperCase().startsWith('F') ? '♀' : '♂'} ${t('tooltipShareBed', { bed: bar.shareBedIndex })}`
      : bar.shareEligible
        ? t('tooltipShare')
        : null;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[200] w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-[#D5DADF] bg-white text-[12px] leading-snug shadow-lg"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#E8EEF2] bg-[#F8FAFC] px-3 py-2">
        <p className="text-[13px] font-semibold text-[#2C3E50]">{bar.guest.fullName}</p>
        <span className="shrink-0 rounded-full bg-[#EBF5FB] px-2 py-0.5 text-[10px] font-semibold text-[#2980B9]">
          {tRes(bar.status)}
        </span>
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 px-3 py-2">
        <Row label={t('tooltipStay')} value={`${stay} · ${pax}${meal}`} />
        <Row
          label={t('tooltipRoom')}
          value={
            [bar.room?.roomNumber, bar.roomType.code, shareLabel].filter(Boolean).join(' · ') ||
            null
          }
        />
        <Row label={t('tooltipResNo')} value={bar.resNo} />
        <Row label={t('tooltipAgency')} value={bar.agency?.name} />
        <Row label={t('tooltipSource')} value={bar.source?.name} />
        <Row
          label={t('tooltipPayment')}
          value={[bar.paymentMethod, bar.paidBy].filter(Boolean).join(' · ') || null}
        />
        <Row label={t('tooltipDaily')} value={formatMoney(bar.dailyRate)} />
        <Row label={t('tooltipTotal')} value={formatMoney(bar.totalAmount)} />
        <Row label={t('tooltipGuestBalance')} value={formatMoney(bar.guestBalance)} />
        <Row label={t('tooltipAgencyBalance')} value={formatMoney(bar.agencyBalance)} />
        <Row label={t('tooltipNote')} value={bar.note} />
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
  const pax = formatPax(bar.adults, bar.children11_6, bar.children5_2, bar.children1_0);
  const meal = bar.mealPlanCode ? ` (${bar.mealPlanCode})` : '';
  const caption = `${bar.guest.fullName} ${pax}${meal}`;

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
        aria-label={caption}
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
          {caption}
        </span>
      </button>
      {hoverRect ? <BarTooltip bar={bar} anchor={hoverRect} /> : null}
    </>
  );
}
