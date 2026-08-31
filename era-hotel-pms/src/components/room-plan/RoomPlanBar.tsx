'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { formatPax, formatPlanDate } from './format';
import { barSvgPath, type BarShapeFlags } from './shapes';
import {
  BAR_LABEL_PAD_LEFT_PX,
  CHEVRON_PX,
  HK_SQUARE_COLORS,
  resolveHkSquareKind,
  resolvePlanBarDayState,
  themeForDayState,
  type HkSquareKind,
  type PlanBarInput,
} from './plan-bar-theme';
import type { RoomPlanReservationBar, RoomStatus } from './types';

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

function HkSquare({ kind }: { kind: Exclude<HkSquareKind, null> }) {
  return (
    <span
      className="pointer-events-none absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-y-1/2 rounded-[2px] border border-black/10"
      style={{ left: 4, backgroundColor: HK_SQUARE_COLORS[kind] }}
      aria-hidden
    />
  );
}

export function RoomPlanBar({
  bar,
  shape,
  selected,
  draggable,
  roomBars,
  roomStatus,
  roomHkCondition,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  bar: RoomPlanReservationBar;
  shape: BarShapeFlags;
  selected: boolean;
  draggable: boolean;
  roomBars: RoomPlanReservationBar[];
  roomStatus?: RoomStatus;
  roomHkCondition?: string | null;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [widthPx, setWidthPx] = useState(80);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidthPx(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inputs: PlanBarInput[] = roomBars.map((r) => ({
    id: r.id,
    status: r.status,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    shareEligible: r.shareEligible,
    shareGender: r.shareGender,
    adults: r.adults,
    roomId: r.roomId,
  }));
  const selfInput: PlanBarInput = {
    id: bar.id,
    status: bar.status,
    checkInDate: bar.checkInDate,
    checkOutDate: bar.checkOutDate,
    shareEligible: bar.shareEligible,
    shareGender: bar.shareGender,
    adults: bar.adults,
    roomId: bar.roomId,
  };
  const dayState = resolvePlanBarDayState(selfInput, inputs);
  const theme = themeForDayState(dayState);
  const hkKind =
    roomStatus != null
      ? resolveHkSquareKind({ status: roomStatus, hkCondition: roomHkCondition })
      : null;

  const pax = formatPax(bar.adults, bar.children11_6, bar.children5_2, bar.children1_0);
  const meal = bar.mealPlanCode ? ` (${bar.mealPlanCode})` : '';
  const caption = `${bar.guest.fullName} ${pax}${meal}`;
  const labelPad = BAR_LABEL_PAD_LEFT_PX + (hkKind ? 10 : 0);

  const showTooltip = useCallback((el: HTMLButtonElement | null) => {
    if (el) setHoverRect(el.getBoundingClientRect());
    else setHoverRect(null);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
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
          viewBox={`0 0 ${Math.max(widthPx, CHEVRON_PX * 2 + 4)} 26`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={barSvgPath(shape, widthPx, 26)}
            fill={theme.fill}
            stroke={theme.stroke}
            strokeWidth={0.6}
            strokeDasharray={theme.dashed ? '3 2' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {hkKind ? <HkSquare kind={hkKind} /> : null}
        <span
          className="pointer-events-none absolute inset-0 flex items-center truncate pr-2 text-left text-[10px] font-bold"
          style={{ paddingLeft: labelPad, color: theme.text }}
        >
          {caption}
        </span>
      </button>
      {hoverRect ? <BarTooltip bar={bar} anchor={hoverRect} /> : null}
    </>
  );
}
