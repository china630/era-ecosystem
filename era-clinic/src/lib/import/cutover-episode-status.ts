/**
 * Cutover episode status: checkout already in the past → IMPORTED_CLOSED (archive).
 * Live hotel checkout still writes CLOSED. Empty / future stay OPEN.
 * Date-only midnight values mean end of that Baku calendar day (WO often sends T00:00:00).
 */

const BAKU_TZ = "Asia/Baku";

export const CUTOVER_EPISODE_OPEN = "OPEN";
export const CUTOVER_EPISODE_IMPORTED_CLOSED = "IMPORTED_CLOSED";

export type CutoverEpisodeStatus =
  | typeof CUTOVER_EPISODE_OPEN
  | typeof CUTOVER_EPISODE_IMPORTED_CLOSED;

export function ymdBaku(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BAKU_TZ }).format(d);
}

function isDateOnlyMidnight(d: Date): boolean {
  const utcMid =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  const localMid =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  return utcMid || localMid;
}

export function cutoverEpisodeFromCheckout(
  checkOut: Date | null,
  asOf = new Date(),
): { status: CutoverEpisodeStatus; closedAt: Date | null } {
  if (!checkOut) {
    return { status: CUTOVER_EPISODE_OPEN, closedAt: null };
  }
  let instant = checkOut;
  if (isDateOnlyMidnight(checkOut)) {
    const ymd = ymdBaku(checkOut);
    instant = new Date(`${ymd}T23:59:59.999+04:00`);
  }
  if (instant.getTime() < asOf.getTime()) {
    return { status: CUTOVER_EPISODE_IMPORTED_CLOSED, closedAt: checkOut };
  }
  return { status: CUTOVER_EPISODE_OPEN, closedAt: null };
}
