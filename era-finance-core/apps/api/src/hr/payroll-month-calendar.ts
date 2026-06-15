/** Ayın sonuncu günü (UTC noon). */
export function monthEndUtc(year: number, month1to12: number): Date {
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return new Date(Date.UTC(year, month1to12 - 1, last, 12, 0, 0, 0));
}
