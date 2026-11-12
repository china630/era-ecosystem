import { createHash, randomInt } from "crypto";

export const GUEST_STAY_ORDER_KINDS = [
  "HOUSEKEEPING",
  "DND",
  "TOWELS",
  "WATER",
  "MINIBAR",
  "WAKEUP",
  "LATE_CHECKOUT",
  "ARRIVAL_TIME",
] as const;

export type GuestStayOrderKindCode = (typeof GUEST_STAY_ORDER_KINDS)[number];

export const GUEST_OTP_TTL_MS = 5 * 60 * 1000;

export function hashGuestSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function mintOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function otpExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + GUEST_OTP_TTL_MS);
}

export function assertBookingRequestDates(checkIn: Date, checkOut: Date): string | null {
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return "BAD_DATES";
  if (checkOut.getTime() <= checkIn.getTime()) return "BAD_DATES";
  return null;
}

export function guestBookingPublicStatus(args: {
  requestStatus: "REQUESTED" | "ANSWERED" | "CANCELLED";
  reservationStatus: string | null;
}): string {
  if (args.requestStatus === "CANCELLED") return "cancelled";
  if (args.requestStatus === "REQUESTED") return "requested";
  if (!args.reservationStatus) return "answered";
  if (args.reservationStatus === "CONFIRMED" || args.reservationStatus === "IN_HOUSE") {
    return "confirmed";
  }
  if (args.reservationStatus === "OPTION") return "awaiting_payment";
  if (args.reservationStatus === "CANCELLED" || args.reservationStatus === "NO_SHOW") {
    return "cancelled";
  }
  return "answered";
}

export function assertStayOrderKind(kind: string): kind is GuestStayOrderKindCode {
  return (GUEST_STAY_ORDER_KINDS as readonly string[]).includes(kind);
}

/**
 * Owner `enabledOrderKinds` from orch Guest app brand.
 * Null / empty / non-array → all kinds allowed (default until owner tightens).
 */
export function stayOrderKindAllowed(
  kind: string,
  enabledOrderKinds: unknown,
): boolean {
  if (!assertStayOrderKind(kind)) return false;
  if (enabledOrderKinds == null) return true;
  if (!Array.isArray(enabledOrderKinds) || enabledOrderKinds.length === 0) return true;
  return enabledOrderKinds.map(String).includes(kind);
}

export function isOtaEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return (
    lower.includes("@guest.booking.com") ||
    lower.includes("@m.expediapartnercentral.com") ||
    lower.includes("noreply") ||
    lower.endsWith(".booking.com")
  );
}

export type CareTimetableRow = {
  id: string;
  scheduledAt: string;
  procedureName: string;
  room: string | null;
  status: string;
};

export type CareResultRow = {
  id: string;
  title: string;
  publishedAt: string;
};

export type CareEpisodeRow = {
  id: string;
  label: string;
  startedAt: string | null;
  closedAt: string | null;
};

/** Pure gate: family grant may see timetable only when desk-confirmed and not revoked. */
export function familyGrantAllowsTimetable(grant: {
  revokedAt: Date | null;
  deskConfirmedAt: Date | null;
}): boolean {
  return !grant.revokedAt && Boolean(grant.deskConfirmedAt);
}

/** Results are never exposed through a family grant. */
export function familyGrantAllowsResults(): boolean {
  return false;
}
