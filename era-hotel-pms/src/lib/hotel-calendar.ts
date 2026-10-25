/**
 * Hotel property calendar helpers (Asia/Baku).
 *
 * Stay policy: check-in 14:00, check-out 12:00 local time.
 * Stored as UTC instants (14:00 Baku = 10:00Z, 12:00 Baku = 08:00Z).
 */

import { ERA_TIME_ZONE, bakuCivilUtcDate, bakuDateKey, todayBakuYmd } from '@era/satellite-kit/time';

export const HOTEL_TIME_ZONE = ERA_TIME_ZONE;
export const CHECK_IN_HOUR_BAKU = 14;
export const CHECK_OUT_HOUR_BAKU = 12;

/** YYYY-MM-DD in the hotel property timezone. */
export function hotelDateKey(isoOrDate: string | Date = new Date()): string {
  return bakuDateKey(isoOrDate);
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

/**
 * Occupied hotel night D: [12:00 Baku D, 12:00 Baku D+1).
 * Checkout at 12:00 does not occupy D (same-day turnover).
 * Civil `bakuDayBounds` is the wrong window — it still holds the departure morning.
 */
export function hotelNightBounds(isoOrKey: string | Date): { start: Date; end: Date } {
  const key = hotelDateKey(isoOrKey);
  return {
    start: parseHotelNoon(key),
    end: parseHotelNoon(addHotelDays(key, 1)),
  };
}

/** True when a stay consumes a door on hotel night D (FO Avl/Occ / sellable / create). */
export function stayOccupiesHotelNight(
  checkIn: Date | string,
  checkOut: Date | string,
  night: string | Date,
): boolean {
  const cin = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const cout = checkOut instanceof Date ? checkOut : new Date(checkOut);
  const { start, end } = hotelNightBounds(night);
  return cin < end && cout > start;
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

/**
 * Guest is present on this civil hotel date (Asia/Baku): check-in through
 * checkout morning inclusive. Used by the door rack (departure still shows).
 */
export function stayTouchesHotelDate(
  checkIn: Date | string,
  checkOut: Date | string,
  dateKey: string,
): boolean {
  const ci = hotelDateKey(checkIn);
  const co = hotelDateKey(checkOut);
  return ci <= dateKey && co >= dateKey;
}

/** Inclusive hotel-date interval [fromKey, toKey] (order-independent). */
export function stayTouchesHotelDateRange(
  checkIn: Date | string,
  checkOut: Date | string,
  fromKey: string,
  toKey: string,
): boolean {
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;
  const ci = hotelDateKey(checkIn);
  const co = hotelDateKey(checkOut);
  return ci <= hi && co >= lo;
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

/**
 * Door clash window. An in-house move only needs the tail from today (Asia/Baku)
 * through checkout. Nights already lived stay on the old door and do not block
 * the new one. A pre-arrival stay still clashes on the whole reservation.
 * Null when no night remains (checkout is today or earlier).
 */
export function doorClashWindow(
  status: string,
  checkIn: Date | string,
  checkOut: Date | string,
  todayKey = todayBakuYmd(),
): { from: Date; to: Date } | null {
  const out = checkOut instanceof Date ? checkOut : new Date(checkOut);
  const checkoutKey = hotelDateKey(out);
  const arrivalKey = hotelDateKey(checkIn);
  const fromKey = status === 'IN_HOUSE' && arrivalKey < todayKey ? todayKey : arrivalKey;
  if (fromKey >= checkoutKey) return null;
  const from =
    status === 'IN_HOUSE'
      ? bakuCivilUtcDate(fromKey)
      : checkIn instanceof Date
        ? checkIn
        : new Date(checkIn);
  return { from, to: out };
}

/** Calendar nights between stay edges (minimum 1). */
export function stayNights(checkIn: Date, checkOut: Date): number {
  const a = parseHotelNoon(checkIn);
  const b = parseHotelNoon(checkOut);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}
