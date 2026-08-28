/**
 * Cutover #21 episode status: past checkOut → IMPORTED_CLOSED (archive).
 * Live hotel checkout still writes CLOSED. Empty / today / future stay OPEN.
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

export function cutoverEpisodeFromCheckout(
  checkOut: Date | null,
  asOf = new Date(),
): { status: CutoverEpisodeStatus; closedAt: Date | null } {
  if (!checkOut) {
    return { status: CUTOVER_EPISODE_OPEN, closedAt: null };
  }
  if (ymdBaku(checkOut) < ymdBaku(asOf)) {
    return { status: CUTOVER_EPISODE_IMPORTED_CLOSED, closedAt: checkOut };
  }
  return { status: CUTOVER_EPISODE_OPEN, closedAt: null };
}
