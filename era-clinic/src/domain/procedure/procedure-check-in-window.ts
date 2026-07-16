/** Pure helpers for procedure check-in window (no Prisma / jose). */

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

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
