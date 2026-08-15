/** Pure helpers for procedure check-in window (no Prisma / jose). */

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/**
 * Legacy −before/+after window (kept for overdue lists / display helpers).
 * Happy-path check-in uses {@link resolveCheckInDeadline} instead.
 */
export function isWithinCheckInWindow(
  scheduledAt: Date,
  now: Date,
  beforeMin: number,
  afterMin: number,
): boolean {
  const early = addMinutes(scheduledAt, -beforeMin);
  const late = addMinutes(scheduledAt, afterMin);
  return now >= early && now <= late;
}

/**
 * Unified check-in deadline for all channels (QR / MANUAL / OVERRIDE):
 * - base: until procedure `endsAt`
 * - optional grace to `endsAt + gapMinutes` only when the next turnover slot
 *   on the resource is free (no active booking overlapping (endsAt, endsAt+gap])
 * Never slides the following schedule — if next slot is occupied, hard stop at endsAt.
 */
export function resolveCheckInDeadline(
  endsAt: Date,
  gapMinutes: number,
  nextGapOccupied: boolean,
): Date {
  if (gapMinutes > 0 && !nextGapOccupied) {
    return addMinutes(endsAt, gapMinutes);
  }
  return endsAt;
}

export function isWithinDynamicCheckInWindow(
  scheduledAt: Date,
  endsAt: Date,
  now: Date,
  beforeMin: number,
  gapMinutes: number,
  nextGapOccupied: boolean,
): boolean {
  const early = addMinutes(scheduledAt, -beforeMin);
  const deadline = resolveCheckInDeadline(endsAt, gapMinutes, nextGapOccupied);
  return now >= early && now <= deadline;
}
