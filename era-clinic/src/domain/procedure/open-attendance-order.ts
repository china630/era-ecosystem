/**
 * Display order for open attendance vs timed procedures (CLI-62).
 * Pure helpers — safe for client and server.
 */

export function isOpenSchedulingMode(mode: string | null | undefined): boolean {
  return mode === "OPEN";
}

export function isOpenUnseatedOrder(input: {
  schedulingMode?: string | null;
  resourceId?: string | null;
}): boolean {
  return isOpenSchedulingMode(input.schedulingMode) && !input.resourceId;
}

/**
 * Within one civil day: OPEN unseated (free attendance) first, then timed rows by clock.
 */
export function compareOpenUnseatedFirst(
  a: { openUnseated: boolean; atMs: number },
  b: { openUnseated: boolean; atMs: number },
): number {
  const aOpen = a.openUnseated ? 0 : 1;
  const bOpen = b.openUnseated ? 0 : 1;
  if (aOpen !== bOpen) return aOpen - bOpen;
  return a.atMs - b.atMs;
}
