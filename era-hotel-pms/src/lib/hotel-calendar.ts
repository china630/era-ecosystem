/**
 * Hotel property calendar helpers (Asia/Baku).
 *
 * Stay policy: check-in 14:00, check-out 12:00 local time.
 * Stored as UTC instants (14:00 Baku = 10:00Z, 12:00 Baku = 08:00Z).
 */

export const HOTEL_TIME_ZONE = 'Asia/Baku';
export const CHECK_IN_HOUR_BAKU = 14;
export const CHECK_OUT_HOUR_BAKU = 12;

/** YYYY-MM-DD in the hotel property timezone. */
export function hotelDateKey(isoOrDate: string | Date = new Date()): string {
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate;
  }
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return String(isoOrDate).slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TIME_ZONE }).format(d);
}

/** Grid / stay anchor at hotel noon (12:00 Baku = 08:00 UTC). */
export function parseHotelNoon(isoOrKey: string | Date): Date {
  const key = hotelDateKey(isoOrKey);
  return new Date(`${key}T08:00:00.000Z`);
}

/** Planned check-in instant for a calendar day (14:00 Asia/Baku). */
export function stayCheckIn(isoOrKey: string | Date): Date {
  const key = hotelDateKey(isoOrKey);
  return new Date(`${key}T${String(CHECK_IN_HOUR_BAKU).padStart(2, '0')}:00:00.000+04:00`);
}

/** Planned check-out instant for a calendar day (12:00 Asia/Baku). */
export function stayCheckOut(isoOrKey: string | Date): Date {
  const key = hotelDateKey(isoOrKey);
  return new Date(`${key}T${String(CHECK_OUT_HOUR_BAKU).padStart(2, '0')}:00:00.000+04:00`);
}

/** Add calendar days in Asia/Baku (stable across host TZ). */
export function addHotelDays(isoOrKey: string | Date, days: number): string {
  const noon = parseHotelNoon(isoOrKey);
  noon.setUTCDate(noon.getUTCDate() + days);
  return hotelDateKey(noon);
}

/** True stay overlap (double booking), not adjacent checkout/check-in turnover. */
export function staysOverlap(
  aIn: Date,
  aOut: Date,
  bIn: Date,
  bOut: Date,
): boolean {
  return aIn.getTime() < bOut.getTime() && bIn.getTime() < aOut.getTime();
}

/** Reservation stay overlap (same rule as assign / share-lanes / paint). */
export function reservationStayOverlaps(
  a: { checkInDate: Date | string; checkOutDate: Date | string },
  b: { checkInDate: Date | string; checkOutDate: Date | string },
): boolean {
  const aIn = a.checkInDate instanceof Date ? a.checkInDate : new Date(a.checkInDate);
  const aOut = a.checkOutDate instanceof Date ? a.checkOutDate : new Date(a.checkOutDate);
  const bIn = b.checkInDate instanceof Date ? b.checkInDate : new Date(b.checkInDate);
  const bOut = b.checkOutDate instanceof Date ? b.checkOutDate : new Date(b.checkOutDate);
  return staysOverlap(aIn, aOut, bIn, bOut);
}

/** Calendar nights between stay edges (minimum 1). */
export function stayNights(checkIn: Date, checkOut: Date): number {
  const a = parseHotelNoon(checkIn);
  const b = parseHotelNoon(checkOut);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}
