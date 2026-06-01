import type { RoomPlanReservationBar } from './types';

/** Hotel property calendar (matches seed/API noon Baku stored as 08:00 UTC). */
export const HOTEL_TIME_ZONE = 'Asia/Baku';

export type BarShapeFlags = {
  turnoverStart: boolean;
  turnoverEnd: boolean;
  sameDayStay: boolean;
};

export type PlacedBar = {
  reservation: RoomPlanReservationBar;
  colStart: number;
  span: number;
  turnoverStart: boolean;
  turnoverEnd: boolean;
  sameDayStay: boolean;
  clippedAtStart: boolean;
  clippedAtEnd: boolean;
};

const NOTCH_EDGE_X = 18;
const NOTCH_CTRL_X = 30;
const TIP_X = 88;

export function calendarDateKey(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TIME_ZONE }).format(d);
}

export function formatLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TIME_ZONE }).format(d);
}

/** Grid anchor at hotel noon (08:00 UTC) for stable column math. */
export function parseCalendarDate(iso: string): Date {
  const key = calendarDateKey(iso);
  return new Date(`${key}T08:00:00.000Z`);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function nightCount(checkIn: Date, checkOut: Date): number {
  return Math.max(1, daysBetween(checkIn, checkOut));
}

/** True overlap (double booking), not adjacent checkout/check-in turnover. */
function stayOverlaps(
  a: RoomPlanReservationBar,
  b: RoomPlanReservationBar,
): boolean {
  const aCi = parseCalendarDate(a.checkInDate).getTime();
  const aCo = parseCalendarDate(a.checkOutDate).getTime();
  const bCi = parseCalendarDate(b.checkInDate).getTime();
  const bCo = parseCalendarDate(b.checkOutDate).getTime();
  return aCi < bCo && bCi < aCo;
}

export function hasSameDayTurnoverStart(
  bar: RoomPlanReservationBar,
  roomBars: RoomPlanReservationBar[],
  options?: { clippedAtStart?: boolean },
): boolean {
  if (options?.clippedAtStart) return false;
  const checkInKey = calendarDateKey(bar.checkInDate);
  if (checkInKey === calendarDateKey(bar.checkOutDate)) return false;
  return roomBars.some((other) => {
    if (other.id === bar.id) return false;
    if (stayOverlaps(bar, other)) return false;
    const otherCiKey = calendarDateKey(other.checkInDate);
    const otherCoKey = calendarDateKey(other.checkOutDate);
    return otherCoKey === checkInKey && otherCiKey < otherCoKey;
  });
}

export function hasSameDayTurnoverEnd(
  bar: RoomPlanReservationBar,
  roomBars: RoomPlanReservationBar[],
  options?: { clippedAtEnd?: boolean },
): boolean {
  if (options?.clippedAtEnd) return false;
  const checkOutKey = calendarDateKey(bar.checkOutDate);
  if (checkOutKey === calendarDateKey(bar.checkInDate)) return false;
  return roomBars.some((other) => {
    if (other.id === bar.id) return false;
    if (stayOverlaps(bar, other)) return false;
    const otherCiKey = calendarDateKey(other.checkInDate);
    const otherCoKey = calendarDateKey(other.checkOutDate);
    return otherCiKey === checkOutKey && otherCiKey < otherCoKey;
  });
}

export function barSvgPath(flags: BarShapeFlags): string {
  if (flags.turnoverStart) {
    return `M ${NOTCH_EDGE_X} 0 L ${TIP_X} 0 L 100 10 L ${TIP_X} 20 L ${NOTCH_EDGE_X} 20 Q ${NOTCH_CTRL_X} 10 ${NOTCH_EDGE_X} 0 Z`;
  }
  if (flags.turnoverEnd) {
    return `M 0 0 L 100 0 L 100 20 L 0 20 Z`;
  }
  return `M 0 0 L ${TIP_X} 0 L 100 10 L ${TIP_X} 20 L 0 20 Z`;
}

/** @deprecated use barSvgPath */
export function barClipPath(flags: BarShapeFlags): string {
  return barSvgPath(flags);
}

export function barLayoutOffset(
  days: number,
  cell: Pick<
    PlacedBar,
    'turnoverStart' | 'turnoverEnd' | 'sameDayStay' | 'colStart' | 'span' | 'clippedAtStart'
  >,
): { leftPct: number; widthPct: number } {
  const half = (0.5 / days) * 100;
  const colPct = (cell.colStart / days) * 100;
  const spanPct = (cell.span / days) * 100;

  if (cell.sameDayStay) {
    if (cell.turnoverStart) {
      return { leftPct: colPct + half, widthPct: half };
    }
    if (cell.turnoverEnd) {
      return { leftPct: colPct, widthPct: half };
    }
    return { leftPct: colPct + half, widthPct: half };
  }

  // Noon check-in/out: start +½ cell, end −½ cell. Turnover only changes SVG shape, not column math.
  const leftPct = colPct + (cell.clippedAtStart ? 0 : half);
  const widthPct = spanPct - (cell.clippedAtStart ? half : half) - half;

  return { leftPct, widthPct: Math.max(widthPct, half * 0.5) };
}

export function computePlacedBars(
  from: Date,
  days: number,
  roomBars: RoomPlanReservationBar[],
): PlacedBar[] {
  const out: PlacedBar[] = [];
  for (const r of roomBars) {
    const ci = parseCalendarDate(r.checkInDate);
    const co = parseCalendarDate(r.checkOutDate);
    const ciKey = calendarDateKey(r.checkInDate);
    const coKey = calendarDateKey(r.checkOutDate);
    const sameDayStay = ciKey === coKey;

    const rawColStart = daysBetween(from, ci);
    const clippedAtStart = rawColStart < 0;
    let colStart = Math.max(0, rawColStart);
    let span = nightCount(ci, co);
    if (clippedAtStart) {
      span += rawColStart;
    }
    if (colStart >= days || span < 1) continue;

    const checkoutCol = daysBetween(from, co);
    const clippedAtEnd = checkoutCol >= days;

    const turnoverStart = hasSameDayTurnoverStart(r, roomBars, { clippedAtStart });
    const turnoverEnd = hasSameDayTurnoverEnd(r, roomBars, { clippedAtEnd });

    if (!sameDayStay) {
      if (checkoutCol >= colStart && checkoutCol < days) {
        span = checkoutCol - colStart + 1;
      }
    } else {
      span = 1;
    }

    span = Math.min(span, days - colStart);
    if (span < 1) continue;

    out.push({
      reservation: r,
      colStart,
      span,
      turnoverStart,
      turnoverEnd,
      sameDayStay,
      clippedAtStart,
      clippedAtEnd,
    });
  }
  return out;
}
