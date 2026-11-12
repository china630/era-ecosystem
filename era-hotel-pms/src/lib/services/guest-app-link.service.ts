import { createHash, randomBytes, randomInt } from "crypto";

export const GUEST_APP_LINK_TTL_MS = 2 * 60 * 1000;

export type GuestAppLinkError =
  | "EXPIRED"
  | "CONSUMED"
  | "NOT_FOUND"
  | "WRONG_ORG"
  | "WRONG_GUEST"
  | "REVOKED";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function mintLinkCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Opaque token: `{organizationId}.{secret}` so Nest can enter the tenant before Prisma. */
export function mintSessionToken(organizationId: string): string {
  const org = organizationId.trim();
  if (!org) throw new Error("mintSessionToken requires organizationId");
  return `${org}.${randomBytes(32).toString("hex")}`;
}

export function organizationIdFromGuestToken(token: string): string | null {
  const raw = token.trim();
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const organizationId = raw.slice(0, dot).trim();
  if (!organizationId || organizationId.includes("|")) return null;
  return organizationId;
}

export function linkExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + GUEST_APP_LINK_TTL_MS);
}

export function assertChallengeUsable(args: {
  now: Date;
  organizationId: string;
  challenge: {
    organizationId: string;
    expiresAt: Date;
    consumedAt: Date | null;
    reservationGuestId: string;
  } | null;
  expectedGuestId?: string;
}): GuestAppLinkError | null {
  if (!args.challenge) return "NOT_FOUND";
  if (args.challenge.organizationId !== args.organizationId) return "WRONG_ORG";
  if (args.expectedGuestId && args.challenge.reservationGuestId !== args.expectedGuestId) {
    return "WRONG_GUEST";
  }
  if (args.challenge.consumedAt) return "CONSUMED";
  if (args.challenge.expiresAt.getTime() <= args.now.getTime()) return "EXPIRED";
  return null;
}

export function statusForLinkError(err: GuestAppLinkError): number {
  if (err === "WRONG_ORG" || err === "NOT_FOUND") return 404;
  if (err === "WRONG_GUEST") return 403;
  return 401;
}

export type TripTransfer = {
  direction: string;
  flightNo: string | null;
  pickupAt: string;
  vehicleCode: string | null;
  notes: string | null;
  status: string;
};

export type TripPack = {
  loadedAt: string;
  reservationId: string;
  reservationGuestId: string;
  confirmation: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  party: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    isPrimary: boolean;
  }>;
  hotel: { name: string; address: string | null; phone: string | null };
  transfers: TripTransfer[];
};

export function buildTripPack(args: {
  loadedAt: Date;
  reservation: {
    id: string;
    status: string;
    resNo: string | null;
    voucherNo: string | null;
    checkIn: Date | null;
    checkOut: Date | null;
    paxGuests: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      isPrimary: boolean;
    }>;
    transferOrders: Array<{
      direction: string;
      flightNo: string | null;
      pickupAt: Date;
      notes: string | null;
      status: string;
      vehicle: { code: string } | null;
    }>;
  };
  reservationGuestId: string;
  hotel: { name: string; address: string | null; phone: string | null };
}): TripPack {
  return {
    loadedAt: args.loadedAt.toISOString(),
    reservationId: args.reservation.id,
    reservationGuestId: args.reservationGuestId,
    confirmation: args.reservation.resNo ?? args.reservation.voucherNo,
    status: args.reservation.status,
    checkIn: args.reservation.checkIn?.toISOString() ?? null,
    checkOut: args.reservation.checkOut?.toISOString() ?? null,
    party: args.reservation.paxGuests.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      isPrimary: p.isPrimary,
    })),
    hotel: args.hotel,
    transfers: args.reservation.transferOrders
      .filter((t) => t.status === 'BOOKED' || t.status === 'CONFIRMED')
      .map((t) => ({
        direction: t.direction,
        flightNo: t.flightNo,
        pickupAt: t.pickupAt.toISOString(),
        vehicleCode: t.vehicle?.code ?? null,
        notes: t.notes,
        status: t.status,
      })),
  };
}

/** Questionnaire readiness uses the same gates as hotel check-in. */
export function questionnaireGaps(guest: {
  sex: string | null;
  birthDate: Date | null;
  nationality: string | null;
  passportNo: string | null;
  idCardNo: string | null;
  phone: string | null;
  ageYears: number | null;
}): string[] {
  const gaps: string[] = [];
  if (!guest.sex) gaps.push("sex");
  if (!guest.birthDate) gaps.push("birthDate");
  if (!guest.nationality) gaps.push("nationality");
  const hasDoc = Boolean(guest.passportNo?.trim() || guest.idCardNo?.trim());
  if (!hasDoc) gaps.push("document");
  const az = (guest.nationality ?? "").toUpperCase() === "AZ";
  const adult = guest.ageYears == null || guest.ageYears >= 18;
  if (az && adult && !guest.phone?.trim()) gaps.push("phone");
  return gaps;
}

export function ageYearsFromBirth(birth: Date | null, now = new Date()): number | null {
  if (!birth) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}
