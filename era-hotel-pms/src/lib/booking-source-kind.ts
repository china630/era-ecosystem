/**
 * FO commercial source to counterparty picker rules (Nafta).
 * Source codes: WALKIN | AGENCY | BOOKING (legacy OTA treated as BOOKING).
 */

export type BookingSourceKind = 'WALKIN' | 'AGENCY' | 'BOOKING' | 'OTHER';

const OTA_RE =
  /BOOKING|EXPEDIA|OTA|HALAL|AGODA|AIRBNB|CHANNEL|BOOKING\.COM|BOOKING-COM|EXELY|OSTROVOK/i;

export function bookingSourceKind(code: string | undefined | null): BookingSourceKind {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return 'OTHER';
  if (c === 'WALKIN' || c === 'WALK-IN' || c === 'WALK_IN') return 'WALKIN';
  if (c === 'AGENCY' || c === 'AGENT' || c === 'TRAVEL') return 'AGENCY';
  if (c === 'BOOKING' || c === 'OTA' || c === 'CHANNEL') return 'BOOKING';
  return 'OTHER';
}

/** Nafta Agency rows used as OTA / Booking.com / Expedia counterparts. */
export function isOtaAgency(code: string, name?: string | null): boolean {
  return OTA_RE.test(code) || OTA_RE.test(name ?? '');
}
