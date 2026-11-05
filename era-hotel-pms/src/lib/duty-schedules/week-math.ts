/** Calendar week helpers for duty boards (UTC noon-safe date-only). */

export function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
