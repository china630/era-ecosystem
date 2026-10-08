import { hotelDateKey } from '@/lib/hotel-calendar';

function leap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Month-day birthday that falls on a night of the stay. Checkout day never counts. */
export function birthdayNightInStay(
  birth: string | Date | null | undefined,
  checkIn: string,
  checkOut: string,
): string | null {
  if (!birth) return null;
  const key = hotelDateKey(birth instanceof Date ? birth : String(birth));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const md = key.slice(5);
  const ci = checkIn.slice(0, 10);
  const co = checkOut.slice(0, 10);
  const startYear = Number(ci.slice(0, 4));
  const endYear = Number(co.slice(0, 4));
  if (!startYear || !endYear) return null;
  for (let year = startYear; year <= endYear; year += 1) {
    if (md === '02-29' && !leap(year)) continue;
    const day = `${year}-${md}`;
    if (day >= ci && day < co) return day;
  }
  return null;
}

/** Visible from two Baku days before the birthday through the birthday itself. */
export function birthdayIconVisible(birthday: string, today: string): boolean {
  const a = Date.parse(`${birthday.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const gap = Math.round((a - b) / 86_400_000);
  return gap >= 0 && gap <= 2;
}
