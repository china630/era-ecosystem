/**
 * Calendar month add with month-end clamp (31 Jan + 1 mo → 28/29 Feb, not Mar 3).
 */
export function addCalendarMonths(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const day = from.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return new Date(Date.UTC(y, m, clamped));
}

/** Skip Sat/Sun (lab). Prefer DataHubClient.addBusinessDays when holiday calendar is available. */
export function bumpToWeekday(from: Date): Date {
  const d = new Date(from.getTime());
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}