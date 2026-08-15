import type { RoomPlanReservationBar } from './types';

/** Hotel property calendar (matches seed/API noon Baku stored as 08:00 UTC). */
export const HOTEL_TIME_ZONE = 'Asia/Baku';

/**
 * Right (departure) edge style of a stay bar:
 * - `arrow`   check-out ends inside the visible window (always a pointed tip);
 * - `flat`    stay continues past the right edge of the window (clipped);
 * - `concave` reserved (arrival notch is leftConcave only).
 *
 * Same-day turnover: departing bar keeps the arrow tip; arriving bar gets
 * leftConcave. Flat is never used for an in-window departure.
 */
export type BarEdgeStyle = 'arrow' | 'concave' | 'flat';

export type BarShapeFlags = {
  /** Concave notch on the arrival (left) edge for a same-day turnover check-in. */
  leftConcave: boolean;
  rightStyle: BarEdgeStyle;
};

export type PlacedBar = {
  reservation: RoomPlanReservationBar;
  colStart: number;
  /** Nights inside the visible window (clipped). */
  span: number;
  /** Left offset of the bar box as a % of the full timeline width. */
  leftPct: number;
  /** Width of the bar box as a % of the full timeline width. */
  widthPct: number;
  shape: BarShapeFlags;
  turnoverStart: boolean;
  turnoverEnd: boolean;
  sameDayStay: boolean;
  clippedAtStart: boolean;
  clippedAtEnd: boolean;
};

/** SVG geometry constants (viewBox 0 0 100 20, stretched to the bar box). */
const ARROW_SHOULDER_X = 88;
const CONCAVE_DEPTH_X = 12;

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

/**
 * Build the bar outline. The path is drawn clockwise:
 * top-left → top-right → right edge (down) → bottom-left → left edge (up) → close.
 *
 * Right edge encodes the departure semantics; the left edge is blunt for a
 * normal/clipped arrival and concave for a same-day turnover check-in. Clipped
 * ends are flat so the bar visibly bleeds to the window boundary ("continues").
 */
export function barSvgPath(flags: BarShapeFlags): string {
  const topRightX = flags.rightStyle === 'arrow' ? ARROW_SHOULDER_X : 100;

  let rightEdge: string;
  switch (flags.rightStyle) {
    case 'arrow':
      rightEdge = `L 100 10 L ${ARROW_SHOULDER_X} 20`;
      break;
    case 'concave':
      rightEdge = `L ${100 - CONCAVE_DEPTH_X} 10 L 100 20`;
      break;
    default:
      rightEdge = `L 100 20`;
      break;
  }

  const leftEdge = flags.leftConcave ? `L ${CONCAVE_DEPTH_X} 10 L 0 0` : `L 0 0`;

  return `M 0 0 L ${topRightX} 0 ${rightEdge} L 0 20 ${leftEdge} Z`;
}

/**
 * Layout is fully precomputed in {@link computePlacedBars}; this reads the
 * stored box offset (kept as a function for call-site/back-compat + tests).
 */
export function barLayoutOffset(
  _days: number,
  cell: Pick<PlacedBar, 'leftPct' | 'widthPct'>,
): { leftPct: number; widthPct: number } {
  return { leftPct: cell.leftPct, widthPct: cell.widthPct };
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

    // Column of the check-in day and of the check-out (departure) day.
    const rawColStart = daysBetween(from, ci);
    const checkoutCol = daysBetween(from, co);

    const clippedAtStart = rawColStart < 0;
    const clippedAtEnd = checkoutCol >= days;
    const colStart = Math.max(0, rawColStart);

    // Drop stays that fall entirely outside the visible window.
    if (colStart >= days) continue;
    if (!sameDayStay && checkoutCol <= 0) continue;

    // Nights inside the window (informational; column math uses edges below).
    const visEndCol = clippedAtEnd ? days : checkoutCol;
    const span = Math.max(1, visEndCol - colStart);

    const turnoverStart = hasSameDayTurnoverStart(r, roomBars, { clippedAtStart });
    const turnoverEnd = hasSameDayTurnoverEnd(r, roomBars, { clippedAtEnd });

    // Half-day (noon) offset model: a stay occupies from mid check-in column to
    // mid check-out column. Clipped edges snap to the window boundary.
    const half = 0.5 / days;
    let leftFrac: number;
    let rightFrac: number;
    if (sameDayStay) {
      // Day-use / 0-night booking: a small centered chip inside its day.
      leftFrac = (colStart + 0.25) / days;
      rightFrac = (colStart + 0.75) / days;
    } else {
      leftFrac = clippedAtStart ? 0 : (colStart + 0.5) / days;
      rightFrac = clippedAtEnd ? 1 : (checkoutCol + 0.5) / days;
    }
    const widthFrac = Math.max(rightFrac - leftFrac, half * 0.5);

    // Right tip whenever checkout is in-window (incl. turnover). Flat only if clipped.
    const rightStyle: BarEdgeStyle = clippedAtEnd ? 'flat' : 'arrow';
    const leftConcave = !clippedAtStart && !sameDayStay && turnoverStart;

    out.push({
      leftPct: leftFrac * 100,
      widthPct: widthFrac * 100,
      shape: { leftConcave, rightStyle },
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
