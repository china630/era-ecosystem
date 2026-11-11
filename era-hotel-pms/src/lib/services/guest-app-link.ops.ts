import { runWithSatelliteTenant } from "@era/satellite-kit/tenancy";
import { prisma } from "@/lib/prisma";
import {
  assertChallengeUsable,
  buildTripPack,
  hashSecret,
  linkExpiresAt,
  mintLinkCode,
  mintSessionToken,
  organizationIdFromGuestToken,
  questionnaireGaps,
  ageYearsFromBirth,
  statusForLinkError,
  type TripPack,
} from "@/lib/services/guest-app-link.service";

export class GuestAppHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function issueGuestAppLink(args: {
  organizationId: string;
  reservationGuestId: string;
  actorUserId: string | null;
}) {
  const pax = await prisma.reservationGuest.findFirst({
    where: { id: args.reservationGuestId, organizationId: args.organizationId },
    select: { id: true, reservationId: true },
  });
  if (!pax) throw new GuestAppHttpError(404, "PAX_NOT_FOUND");
  const code = mintLinkCode();
  const expiresAt = linkExpiresAt();
  const row = await prisma.guestAppLinkChallenge.create({
    data: {
      organizationId: args.organizationId,
      reservationId: pax.reservationId,
      reservationGuestId: pax.id,
      codeHash: hashSecret(`${args.organizationId}:${code}`),
      expiresAt,
    },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_APP_LINK_ISSUE",
        entityType: "ReservationGuest",
        entityId: pax.id,
        changesJson: JSON.stringify({ challengeId: row.id, expiresAt }),
      },
    })
    .catch(() => undefined);
  const session = await prisma.guestAppDeviceSession.findFirst({
    where: { reservationGuestId: pax.id, revokedAt: null },
    select: { id: true },
  });
  return {
    challengeId: row.id,
    code,
    qrPayload: `ERA-GUEST|${args.organizationId}|${code}`,
    expiresAt: expiresAt.toISOString(),
    deviceLinked: Boolean(session),
  };
}

export async function revokeGuestAppLink(args: {
  organizationId: string;
  reservationGuestId: string;
  actorUserId: string | null;
}) {
  const result = await prisma.guestAppDeviceSession.updateMany({
    where: {
      organizationId: args.organizationId,
      reservationGuestId: args.reservationGuestId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_APP_LINK_REVOKE",
        entityType: "ReservationGuest",
        entityId: args.reservationGuestId,
        changesJson: JSON.stringify({ revoked: result.count }),
      },
    })
    .catch(() => undefined);
  return { revoked: result.count };
}

export async function exchangeGuestAppCode(args: {
  organizationId: string;
  code: string;
}): Promise<{ token: string; trip: TripPack }> {
  const now = new Date();
  const challenge = await prisma.guestAppLinkChallenge.findFirst({
    where: {
      organizationId: args.organizationId,
      codeHash: hashSecret(`${args.organizationId}:${args.code}`),
    },
    orderBy: { createdAt: "desc" },
  });
  const err = assertChallengeUsable({
    now,
    organizationId: args.organizationId,
    challenge,
  });
  if (err || !challenge) {
    throw new GuestAppHttpError(statusForLinkError(err ?? "NOT_FOUND"), err ?? "NOT_FOUND");
  }
  const token = mintSessionToken(args.organizationId);
  await prisma.$transaction([
    prisma.guestAppLinkChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    }),
    prisma.guestAppDeviceSession.updateMany({
      where: {
        reservationGuestId: challenge.reservationGuestId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    }),
    prisma.guestAppDeviceSession.create({
      data: {
        organizationId: challenge.organizationId,
        reservationId: challenge.reservationId,
        reservationGuestId: challenge.reservationGuestId,
        tokenHash: hashSecret(token),
      },
    }),
  ]);
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: null,
        action: "GUEST_APP_LINK_EXCHANGE",
        entityType: "ReservationGuest",
        entityId: challenge.reservationGuestId,
        changesJson: JSON.stringify({ challengeId: challenge.id }),
      },
    })
    .catch(() => undefined);
  const trip = await loadTripPack({
    organizationId: args.organizationId,
    reservationGuestId: challenge.reservationGuestId,
  });
  return { token, trip };
}

async function requireSession(token: string) {
  const row = await prisma.guestAppDeviceSession.findFirst({
    where: { tokenHash: hashSecret(token), revokedAt: null },
  });
  if (!row) throw new GuestAppHttpError(401, "REVOKED");
  await prisma.guestAppDeviceSession.update({
    where: { id: row.id },
    data: { lastSeenAt: new Date() },
  });
  return row;
}

export async function loadTripPack(args: {
  organizationId: string;
  reservationGuestId: string;
}): Promise<TripPack> {
  const pax = await prisma.reservationGuest.findFirst({
    where: { id: args.reservationGuestId, organizationId: args.organizationId },
    select: { id: true, reservationId: true },
  });
  if (!pax) throw new GuestAppHttpError(404, "PAX_NOT_FOUND");
  const reservation = await prisma.reservation.findFirst({
    where: { id: pax.reservationId, organizationId: args.organizationId },
    include: {
      paxGuests: {
        select: { id: true, firstName: true, lastName: true, isPrimary: true },
        orderBy: { sortOrder: "asc" },
      },
      transferOrders: {
        include: { vehicle: { select: { code: true } } },
        orderBy: { pickupAt: "asc" },
      },
    },
  });
  if (!reservation) throw new GuestAppHttpError(404, "RES_NOT_FOUND");
  const hotel = await prisma.hotelProfile.findFirst({
    where: { organizationId: args.organizationId },
    select: { name: true, address: true, phone: true },
  });
  return buildTripPack({
    loadedAt: new Date(),
    reservationGuestId: pax.id,
    hotel: {
      name: hotel?.name ?? "Hotel",
      address: hotel?.address ?? null,
      phone: hotel?.phone ?? null,
    },
    reservation: {
      id: reservation.id,
      status: reservation.status,
      resNo: reservation.resNo,
      voucherNo: reservation.voucherNo,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      paxGuests: reservation.paxGuests,
      transferOrders: reservation.transferOrders,
    },
  });
}

export async function tripPackForToken(token: string): Promise<TripPack> {
  const organizationId = organizationIdFromGuestToken(token);
  if (!organizationId) throw new GuestAppHttpError(401, "REVOKED");
  return runWithSatelliteTenant({ organizationId }, async () => {
    const session = await requireSession(token);
    if (session.organizationId !== organizationId) {
      throw new GuestAppHttpError(401, "REVOKED");
    }
    return loadTripPack({
      organizationId: session.organizationId,
      reservationGuestId: session.reservationGuestId,
    });
  });
}

export async function questionnaireStatus(args: {
  organizationId: string;
  reservationId: string;
}) {
  const rows = await prisma.reservationGuest.findMany({
    where: { organizationId: args.organizationId, reservationId: args.reservationId, departedAt: null },
    include: { guest: { select: { phone: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => {
    const gaps = questionnaireGaps({
      sex: row.sex,
      birthDate: row.birthDate,
      nationality: row.nationality,
      passportNo: row.passportNo,
      idCardNo: row.idCardNo,
      phone: row.guest?.phone ?? null,
      ageYears: ageYearsFromBirth(row.birthDate),
    });
    return {
      reservationGuestId: row.id,
      guestId: row.guestId,
      complete: gaps.length === 0,
      gaps,
    };
  });
}

export async function patchQuestionnaireFromGuest(args: {
  token: string;
  body: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    sex?: string;
    birthDate?: string;
    nationality?: string;
    phone?: string;
    passportNo?: string;
    idCardNo?: string;
  };
}) {
  const organizationId = organizationIdFromGuestToken(args.token);
  if (!organizationId) throw new GuestAppHttpError(401, "REVOKED");
  return runWithSatelliteTenant({ organizationId }, async () => {
    const session = await requireSession(args.token);
    if (session.organizationId !== organizationId) {
      throw new GuestAppHttpError(401, "REVOKED");
    }
    const reservation = await prisma.reservation.findFirst({
      where: { id: session.reservationId, organizationId: session.organizationId },
      select: { id: true, status: true },
    });
    if (!reservation) throw new GuestAppHttpError(404, "RES_NOT_FOUND");
    if (reservation.status === "IN_HOUSE" || reservation.status === "CHECKED_OUT") {
      throw new GuestAppHttpError(403, "CHECKIN_LOCKED");
    }
    const pax = await prisma.reservationGuest.findFirst({
      where: { id: session.reservationGuestId, organizationId: session.organizationId },
    });
    if (!pax) throw new GuestAppHttpError(404, "PAX_NOT_FOUND");
    const birthDate = args.body.birthDate
      ? new Date(`${args.body.birthDate}T00:00:00.000Z`)
      : undefined;
    await prisma.reservationGuest.update({
      where: { id: pax.id },
      data: {
        firstName: args.body.firstName ?? pax.firstName,
        lastName: args.body.lastName ?? pax.lastName,
        middleName: args.body.middleName ?? pax.middleName,
        sex: args.body.sex ?? pax.sex,
        birthDate: birthDate === undefined ? pax.birthDate : birthDate,
        nationality: args.body.nationality ?? pax.nationality,
        passportNo: args.body.passportNo ?? pax.passportNo,
        idCardNo: args.body.idCardNo ?? pax.idCardNo,
      },
    });
    if (pax.guestId && args.body.phone !== undefined) {
      await prisma.guest.update({
        where: { id: pax.guestId },
        data: { phone: args.body.phone || null },
      });
    }
    const status = await questionnaireStatus({
      organizationId: session.organizationId,
      reservationId: session.reservationId,
    });
    return status.find((row) => row.reservationGuestId === pax.id) ?? null;
  });
}
