import { runWithSatelliteTenant } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { GuestAppHttpError } from "@/lib/services/guest-app-link.ops";
import {
  hashSecret,
  mintSessionToken,
  organizationIdFromGuestToken,
} from "@/lib/services/guest-app-link.service";
import {
  assertBookingRequestDates,
  assertStayOrderKind,
  familyGrantAllowsTimetable,
  guestBookingPublicStatus,
  hashGuestSecret,
  isOtaEmail,
  mintOtpCode,
  otpExpiresAt,
  stayOrderKindAllowed,
  type CareEpisodeRow,
  type CareResultRow,
  type CareTimetableRow,
} from "@/lib/services/guest-app-cycle.service";

async function loadEnabledOrderKinds(organizationId: string): Promise<unknown> {
  const base =
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    "";
  if (!base) return null;
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/platform/v1/guest-app/${organizationId}/brand`,
    );
    if (!res.ok) return null;
    const brand = (await res.json()) as { enabledOrderKinds?: unknown };
    return brand.enabledOrderKinds ?? null;
  } catch {
    return null;
  }
}

async function requireSession(token: string) {
  const organizationId = organizationIdFromGuestToken(token);
  if (!organizationId) throw new GuestAppHttpError(401, "REVOKED");
  return runWithSatelliteTenant({ organizationId }, async () => {
    const row = await prisma.guestAppDeviceSession.findFirst({
      where: { tokenHash: hashSecret(token), revokedAt: null },
    });
    if (!row || row.organizationId !== organizationId) {
      throw new GuestAppHttpError(401, "REVOKED");
    }
    await prisma.guestAppDeviceSession.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date() },
    });
    return row;
  });
}

function ymdToUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Cycle 4 — booking request */
export async function createGuestBookingRequest(args: {
  organizationId: string;
  token?: string | null;
  checkInYmd: string;
  checkOutYmd: string;
  adults: number;
  children: number;
  packageNote?: string;
  contactPhone?: string;
  contactName?: string;
}) {
  const checkInDate = ymdToUtc(args.checkInYmd);
  const checkOutDate = ymdToUtc(args.checkOutYmd);
  const bad = assertBookingRequestDates(checkInDate, checkOutDate);
  if (bad) throw new GuestAppHttpError(400, bad);
  if (args.adults < 1) throw new GuestAppHttpError(400, "BAD_PARTY");
  return runWithSatelliteTenant({ organizationId: args.organizationId }, async () => {
    let tokenHash: string | null = null;
    if (args.token) {
      const session = await prisma.guestAppDeviceSession.findFirst({
        where: { tokenHash: hashSecret(args.token), revokedAt: null },
      });
      if (!session) throw new GuestAppHttpError(401, "REVOKED");
      tokenHash = session.tokenHash;
    }
    const row = await prisma.guestBookingRequest.create({
      data: {
        organizationId: args.organizationId,
        checkInDate,
        checkOutDate,
        adults: args.adults,
        children: Math.max(0, args.children),
        packageNote: args.packageNote?.trim() || null,
        contactPhone: args.contactPhone?.trim() || null,
        contactName: args.contactName?.trim() || null,
        createdByTokenHash: tokenHash,
      },
    });
    await prisma.satelliteAuditLog
      .create({
        data: {
          organizationId: args.organizationId,
          userId: null,
          action: "GUEST_BOOKING_REQUEST_CREATE",
          entityType: "GuestBookingRequest",
          entityId: row.id,
          changesJson: JSON.stringify({ adults: row.adults, children: row.children }),
        },
      })
      .catch(() => undefined);
    return serializeBookingRequest(row, null);
  });
}

export async function listGuestBookingRequests(args: {
  organizationId: string;
  token?: string | null;
}) {
  return runWithSatelliteTenant({ organizationId: args.organizationId }, async () => {
    const where: { organizationId: string; createdByTokenHash?: string } = {
      organizationId: args.organizationId,
    };
    if (args.token) {
      where.createdByTokenHash = hashSecret(args.token);
    }
    const rows = await prisma.guestBookingRequest.findMany({
      where,
      include: { reservation: { select: { status: true, resNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((row) =>
      serializeBookingRequest(row, row.reservation?.status ?? null),
    );
  });
}

export async function listStaffBookingRequests(organizationId: string) {
  const rows = await prisma.guestBookingRequest.findMany({
    where: { organizationId, status: { in: ["REQUESTED", "ANSWERED"] } },
    include: { reservation: { select: { id: true, status: true, resNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    ...serializeBookingRequest(row, row.reservation?.status ?? null),
    reservationId: row.reservationId,
    resNo: row.reservation?.resNo ?? null,
  }));
}

export async function answerGuestBookingRequest(args: {
  organizationId: string;
  requestId: string;
  reservationId: string | null;
  cancel: boolean;
  actorUserId: string | null;
  staffNote?: string;
}) {
  const row = await prisma.guestBookingRequest.findFirst({
    where: { id: args.requestId, organizationId: args.organizationId },
  });
  if (!row) throw new GuestAppHttpError(404, "NOT_FOUND");
  if (row.status === "CANCELLED") throw new GuestAppHttpError(409, "CANCELLED");
  if (args.cancel) {
    const updated = await prisma.guestBookingRequest.update({
      where: { id: row.id },
      data: { status: "CANCELLED", staffNote: args.staffNote ?? row.staffNote },
    });
    return serializeBookingRequest(updated, null);
  }
  if (!args.reservationId) throw new GuestAppHttpError(400, "RES_REQUIRED");
  const reservation = await prisma.reservation.findFirst({
    where: { id: args.reservationId, organizationId: args.organizationId },
    select: { id: true, status: true },
  });
  if (!reservation) throw new GuestAppHttpError(404, "RES_NOT_FOUND");
  const updated = await prisma.guestBookingRequest.update({
    where: { id: row.id },
    data: {
      status: "ANSWERED",
      reservationId: reservation.id,
      staffNote: args.staffNote ?? row.staffNote,
    },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_BOOKING_REQUEST_ANSWER",
        entityType: "GuestBookingRequest",
        entityId: row.id,
        changesJson: JSON.stringify({ reservationId: reservation.id }),
      },
    })
    .catch(() => undefined);
  return serializeBookingRequest(updated, reservation.status);
}

function serializeBookingRequest(
  row: {
    id: string;
    checkInDate: Date;
    checkOutDate: Date;
    adults: number;
    children: number;
    packageNote: string | null;
    contactPhone: string | null;
    contactName: string | null;
    status: "REQUESTED" | "ANSWERED" | "CANCELLED";
    reservationId: string | null;
    createdAt: Date;
  },
  reservationStatus: string | null,
) {
  return {
    id: row.id,
    checkIn: row.checkInDate.toISOString().slice(0, 10),
    checkOut: row.checkOutDate.toISOString().slice(0, 10),
    adults: row.adults,
    children: row.children,
    packageNote: row.packageNote,
    contactPhone: row.contactPhone,
    contactName: row.contactName,
    status: guestBookingPublicStatus({
      requestStatus: row.status,
      reservationStatus,
    }),
    reservationId: row.reservationId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Cycle 5 — stay orders */
export async function createGuestStayOrder(args: {
  token: string;
  kind: string;
  note?: string;
  scheduledAt?: string;
  queuedOffline?: boolean;
}) {
  if (!assertStayOrderKind(args.kind)) throw new GuestAppHttpError(400, "BAD_KIND");
  const session = await requireSession(args.token);
  const enabledKinds = await loadEnabledOrderKinds(session.organizationId);
  if (!stayOrderKindAllowed(args.kind, enabledKinds)) {
    throw new GuestAppHttpError(400, "KIND_DISABLED");
  }
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const reservation = await prisma.reservation.findFirst({
      where: { id: session.reservationId, organizationId: session.organizationId },
      select: { id: true, status: true },
    });
    if (!reservation) throw new GuestAppHttpError(404, "RES_NOT_FOUND");
    if (reservation.status === "CHECKED_OUT" || reservation.status === "CANCELLED") {
      throw new GuestAppHttpError(403, "STAY_CLOSED");
    }
    const row = await prisma.guestStayOrder.create({
      data: {
        organizationId: session.organizationId,
        reservationId: session.reservationId,
        reservationGuestId: session.reservationGuestId,
        kind: args.kind,
        status: args.queuedOffline ? "QUEUED" : "REQUESTED",
        note: args.note?.trim() || null,
        scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : null,
      },
    });
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      note: row.note,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function listGuestStayOrders(token: string) {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const rows = await prisma.guestStayOrder.findMany({
      where: {
        organizationId: session.organizationId,
        reservationId: session.reservationId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      note: row.note,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function listStaffStayOrders(args: {
  organizationId: string;
  reservationId: string;
}) {
  const rows = await prisma.guestStayOrder.findMany({
    where: {
      organizationId: args.organizationId,
      reservationId: args.reservationId,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    note: row.note,
    reservationGuestId: row.reservationGuestId,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function patchStaffStayOrderStatus(args: {
  organizationId: string;
  orderId: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  actorUserId: string | null;
}) {
  const row = await prisma.guestStayOrder.findFirst({
    where: { id: args.orderId, organizationId: args.organizationId },
  });
  if (!row) throw new GuestAppHttpError(404, "NOT_FOUND");
  const updated = await prisma.guestStayOrder.update({
    where: { id: row.id },
    data: { status: args.status },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_STAY_ORDER_STATUS",
        entityType: "GuestStayOrder",
        entityId: row.id,
        changesJson: JSON.stringify({ status: args.status }),
      },
    })
    .catch(() => undefined);
  return { id: updated.id, status: updated.status };
}

/** Cycle 6–7 — Care proxy (honest empty when clinic unavailable) */
export async function guestCareTimetable(args: {
  token: string;
  subjectGuestId?: string;
}): Promise<{ items: CareTimetableRow[]; source: "clinic" | "empty"; reason?: string }> {
  const session = await requireSession(args.token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    let subjectId = session.reservationGuestId;
    if (args.subjectGuestId && args.subjectGuestId !== session.reservationGuestId) {
      const grant = await prisma.guestFamilyGrant.findFirst({
        where: {
          organizationId: session.organizationId,
          reservationId: session.reservationId,
          grantorGuestId: session.reservationGuestId,
          granteeGuestId: args.subjectGuestId,
          revokedAt: null,
        },
      });
      if (!grant || !familyGrantAllowsTimetable(grant)) {
        throw new GuestAppHttpError(403, "FAMILY_DENIED");
      }
      subjectId = args.subjectGuestId;
    }
    const pax = await prisma.reservationGuest.findFirst({
      where: { id: subjectId, organizationId: session.organizationId },
      include: { guest: { select: { globalPersonId: true } } },
    });
    const globalPersonId = pax?.guest?.globalPersonId?.trim() || null;
    if (!globalPersonId) {
      return { items: [], source: "empty", reason: "no_global_person" };
    }
    const clinicUrl = process.env.CLINIC_INTERNAL_URL?.trim() || process.env.CLINIC_URL?.trim();
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!clinicUrl || !token) {
      return { items: [], source: "empty", reason: "clinic_unconfigured" };
    }
    try {
      const res = await fetch(
        `${clinicUrl.replace(/\/$/, "")}/api/internal/v1/guest-care/timetable?globalPersonId=${encodeURIComponent(globalPersonId)}&organizationId=${encodeURIComponent(session.organizationId)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { items: [], source: "empty", reason: "clinic_error" };
      const data = (await res.json()) as { items?: CareTimetableRow[] };
      return { items: data.items ?? [], source: "clinic" };
    } catch {
      return { items: [], source: "empty", reason: "clinic_unreachable" };
    }
  });
}

export async function guestCareResults(token: string): Promise<{
  items: CareResultRow[];
  source: "clinic" | "empty";
  reason?: string;
}> {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const pax = await prisma.reservationGuest.findFirst({
      where: { id: session.reservationGuestId, organizationId: session.organizationId },
      include: { guest: { select: { globalPersonId: true } } },
    });
    const globalPersonId = pax?.guest?.globalPersonId?.trim() || null;
    if (!globalPersonId) return { items: [], source: "empty", reason: "no_global_person" };
    const clinicUrl = process.env.CLINIC_INTERNAL_URL?.trim() || process.env.CLINIC_URL?.trim();
    const svc = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!clinicUrl || !svc) return { items: [], source: "empty", reason: "clinic_unconfigured" };
    try {
      const res = await fetch(
        `${clinicUrl.replace(/\/$/, "")}/api/internal/v1/guest-care/results?globalPersonId=${encodeURIComponent(globalPersonId)}&organizationId=${encodeURIComponent(session.organizationId)}`,
        { headers: { authorization: `Bearer ${svc}` } },
      );
      if (!res.ok) return { items: [], source: "empty", reason: "clinic_error" };
      const data = (await res.json()) as { items?: CareResultRow[] };
      return { items: data.items ?? [], source: "clinic" };
    } catch {
      return { items: [], source: "empty", reason: "clinic_unreachable" };
    }
  });
}

export async function guestCareEpisodes(token: string): Promise<{
  items: CareEpisodeRow[];
  source: "clinic" | "empty";
  reason?: string;
}> {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const pax = await prisma.reservationGuest.findFirst({
      where: { id: session.reservationGuestId, organizationId: session.organizationId },
      include: { guest: { select: { globalPersonId: true } } },
    });
    const globalPersonId = pax?.guest?.globalPersonId?.trim() || null;
    if (!globalPersonId) return { items: [], source: "empty", reason: "no_global_person" };
    const clinicUrl = process.env.CLINIC_INTERNAL_URL?.trim() || process.env.CLINIC_URL?.trim();
    const svc = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!clinicUrl || !svc) return { items: [], source: "empty", reason: "clinic_unconfigured" };
    try {
      const res = await fetch(
        `${clinicUrl.replace(/\/$/, "")}/api/internal/v1/guest-care/episodes?globalPersonId=${encodeURIComponent(globalPersonId)}&organizationId=${encodeURIComponent(session.organizationId)}`,
        { headers: { authorization: `Bearer ${svc}` } },
      );
      if (!res.ok) return { items: [], source: "empty", reason: "clinic_error" };
      const data = (await res.json()) as { items?: CareEpisodeRow[] };
      return { items: data.items ?? [], source: "clinic" };
    } catch {
      return { items: [], source: "empty", reason: "clinic_unreachable" };
    }
  });
}

/** Cycle 8 — family grants */
export async function createFamilyGrant(args: {
  token: string;
  granteeGuestId: string;
}) {
  const session = await requireSession(args.token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    if (args.granteeGuestId === session.reservationGuestId) {
      throw new GuestAppHttpError(400, "SELF");
    }
    const grantee = await prisma.reservationGuest.findFirst({
      where: {
        id: args.granteeGuestId,
        organizationId: session.organizationId,
        reservationId: session.reservationId,
      },
    });
    if (!grantee) throw new GuestAppHttpError(403, "WRONG_BOOKING");
    const row = await prisma.guestFamilyGrant.upsert({
      where: {
        reservationId_grantorGuestId_granteeGuestId: {
          reservationId: session.reservationId,
          grantorGuestId: session.reservationGuestId,
          granteeGuestId: args.granteeGuestId,
        },
      },
      create: {
        organizationId: session.organizationId,
        reservationId: session.reservationId,
        grantorGuestId: session.reservationGuestId,
        granteeGuestId: args.granteeGuestId,
      },
      update: { revokedAt: null, deskConfirmedAt: null },
    });
    return {
      id: row.id,
      granteeGuestId: row.granteeGuestId,
      deskConfirmed: Boolean(row.deskConfirmedAt),
      revoked: Boolean(row.revokedAt),
    };
  });
}

export async function revokeFamilyGrant(args: { token: string; grantId: string }) {
  const session = await requireSession(args.token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const row = await prisma.guestFamilyGrant.findFirst({
      where: {
        id: args.grantId,
        organizationId: session.organizationId,
        grantorGuestId: session.reservationGuestId,
      },
    });
    if (!row) throw new GuestAppHttpError(404, "NOT_FOUND");
    await prisma.guestFamilyGrant.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  });
}

export async function confirmFamilyGrantStaff(args: {
  organizationId: string;
  grantId: string;
  actorUserId: string | null;
}) {
  const row = await prisma.guestFamilyGrant.findFirst({
    where: { id: args.grantId, organizationId: args.organizationId, revokedAt: null },
  });
  if (!row) throw new GuestAppHttpError(404, "NOT_FOUND");
  const updated = await prisma.guestFamilyGrant.update({
    where: { id: row.id },
    data: { deskConfirmedAt: new Date() },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_FAMILY_GRANT_CONFIRM",
        entityType: "GuestFamilyGrant",
        entityId: row.id,
        changesJson: JSON.stringify({}),
      },
    })
    .catch(() => undefined);
  return { id: updated.id, deskConfirmedAt: updated.deskConfirmedAt?.toISOString() };
}

export async function listFamilyGrantsForReservation(args: {
  organizationId: string;
  reservationId: string;
}) {
  const rows = await prisma.guestFamilyGrant.findMany({
    where: {
      organizationId: args.organizationId,
      reservationId: args.reservationId,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    grantorGuestId: row.grantorGuestId,
    granteeGuestId: row.granteeGuestId,
    deskConfirmed: Boolean(row.deskConfirmedAt),
  }));
}

/** Cycle 9 — phone OTP (SMS/WA STUB) + confirmation limited pack */
export async function startPhoneOtp(args: {
  organizationId: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  destination: string;
}) {
  const dest = args.destination.trim();
  if (!dest) throw new GuestAppHttpError(400, "DESTINATION");
  if (args.channel === "EMAIL" && isOtaEmail(dest)) {
    throw new GuestAppHttpError(400, "OTA_EMAIL");
  }
  return runWithSatelliteTenant({ organizationId: args.organizationId }, async () => {
    const guest = await prisma.guest.findFirst({
      where:
        args.channel === "EMAIL"
          ? { organizationId: args.organizationId, email: dest }
          : { organizationId: args.organizationId, phone: dest },
      select: { id: true },
    });
    if (!guest) throw new GuestAppHttpError(404, "NOT_FOUND");
    const code = mintOtpCode();
    const expiresAt = otpExpiresAt();
    await prisma.guestAppOtpChallenge.create({
      data: {
        organizationId: args.organizationId,
        channel: args.channel,
        destination: dest,
        codeHash: hashGuestSecret(`${args.organizationId}:${dest}:${code}`),
        expiresAt,
      },
    });
    const { dispatchGuestNotify } = await import("@/lib/services/guest-notify.adapters");
    const notify = await dispatchGuestNotify({
      organizationId: args.organizationId,
      channel: args.channel,
      destination: dest,
      code,
    });
    await prisma.satelliteAuditLog
      .create({
        data: {
          organizationId: args.organizationId,
          userId: null,
          action: "GUEST_APP_OTP_START",
          entityType: "Guest",
          entityId: guest.id,
          changesJson: JSON.stringify({
            channel: args.channel,
            stub: notify.stub,
            provider: notify.provider,
          }),
        },
      })
      .catch(() => undefined);
    return {
      expiresAt: expiresAt.toISOString(),
      channel: args.channel,
      stub: notify.stub,
      /** Dev/stub only — never ship real SMS body when adapters stay STUB. */
      stubCode:
        process.env.NODE_ENV === "production" || !notify.stub ? undefined : code,
    };
  });
}

export async function verifyPhoneOtp(args: {
  organizationId: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  destination: string;
  code: string;
}): Promise<{ token: string }> {
  const dest = args.destination.trim();
  return runWithSatelliteTenant({ organizationId: args.organizationId }, async () => {
    const now = new Date();
    const challenge = await prisma.guestAppOtpChallenge.findFirst({
      where: {
        organizationId: args.organizationId,
        channel: args.channel,
        destination: dest,
        codeHash: hashGuestSecret(`${args.organizationId}:${dest}:${args.code}`),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= now.getTime()) {
      throw new GuestAppHttpError(401, "EXPIRED");
    }
    const guest = await prisma.guest.findFirst({
      where:
        args.channel === "EMAIL"
          ? { organizationId: args.organizationId, email: dest }
          : { organizationId: args.organizationId, phone: dest },
      select: { id: true },
    });
    if (!guest) throw new GuestAppHttpError(404, "NOT_FOUND");
    const pax = await prisma.reservationGuest.findFirst({
      where: {
        organizationId: args.organizationId,
        guestId: guest.id,
        departedAt: null,
      },
      orderBy: { sortOrder: "asc" },
    });
    if (!pax) throw new GuestAppHttpError(404, "PAX_NOT_FOUND");
    await prisma.guestAppOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });
    await prisma.guestAppDeviceSession.updateMany({
      where: { reservationGuestId: pax.id, revokedAt: null },
      data: { revokedAt: now },
    });
    const token = mintSessionToken(args.organizationId);
    await prisma.guestAppDeviceSession.create({
      data: {
        organizationId: args.organizationId,
        reservationId: pax.reservationId,
        reservationGuestId: pax.id,
        tokenHash: hashSecret(token),
      },
    });
    return { token };
  });
}

export async function confirmationLimitedLookup(args: {
  organizationId: string;
  confirmation: string;
  surname: string;
  arrivalYmd: string;
}) {
  return runWithSatelliteTenant({ organizationId: args.organizationId }, async () => {
    const arrival = ymdToUtc(args.arrivalYmd);
    const nextDay = new Date(arrival.getTime() + 24 * 60 * 60 * 1000);
    const reservation = await prisma.reservation.findFirst({
      where: {
        organizationId: args.organizationId,
        OR: [{ resNo: args.confirmation }, { voucherNo: args.confirmation }],
        checkInDate: { gte: arrival, lt: nextDay },
      },
      include: {
        paxGuests: {
          where: {
            lastName: { equals: args.surname.trim(), mode: "insensitive" },
          },
          take: 1,
        },
        transferOrders: {
          include: { vehicle: { select: { code: true } } },
          orderBy: { pickupAt: "asc" },
        },
      },
    });
    if (!reservation || reservation.paxGuests.length === 0) {
      throw new GuestAppHttpError(404, "NOT_FOUND");
    }
    const hotel = await prisma.hotelProfile.findFirst({
      where: { organizationId: args.organizationId },
      select: { name: true, address: true, phone: true },
    });
    return {
      limited: true as const,
      reservationId: reservation.id,
      status: reservation.status,
      confirmation: reservation.resNo ?? reservation.voucherNo,
      checkIn: reservation.checkInDate?.toISOString() ?? null,
      checkOut: reservation.checkOutDate?.toISOString() ?? null,
      hotel: {
        name: hotel?.name ?? "Hotel",
        address: hotel?.address ?? null,
        phone: hotel?.phone ?? null,
      },
      transfers: reservation.transferOrders
        .filter((tr) => tr.status === 'BOOKED' || tr.status === 'CONFIRMED')
        .map((tr) => ({
          direction: tr.direction,
          flightNo: tr.flightNo,
          pickupAt: tr.pickupAt.toISOString(),
          vehicleCode: tr.vehicle?.code ?? null,
          notes: tr.notes,
          status: tr.status,
        })),
      /** Analyses / timetable / document image stay closed until desk QR or phone OTP. */
      careLocked: true,
    };
  });
}

/** Cycle 5 woven — guest folio view (own lines, no diagnosis labels) */
export async function guestFolioSummary(token: string) {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const folios = await prisma.folio.findMany({
      where: {
        organizationId: session.organizationId,
        reservationId: session.reservationId,
        OR: [
          { reservationGuestId: session.reservationGuestId },
          { reservationGuestId: null, type: "GUEST" },
        ],
      },
      include: {
        charges: {
          select: {
            id: true,
            description: true,
            amount: true,
            businessDate: true,
          },
          orderBy: { businessDate: "asc" },
        },
      },
      take: 5,
    });
    return {
      folios: folios.map((f) => {
        const open = f.status === "OPEN";
        return {
          id: f.id,
          status: f.status,
          open,
          settled: !open,
          lines: f.charges.map((c) => ({
            id: c.id,
            /** Charge description only — never diagnosis / clinical text. */
            label: c.description || "Charge",
            amount: String(c.amount),
            postedAt: c.businessDate.toISOString(),
          })),
        };
      }),
    };
  });
}

/** Wave F — meal/board from stay entitlements (no invent). */
export async function guestBoardSummary(token: string) {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const owned = await prisma.reservation.findFirst({
      where: { id: session.reservationId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!owned) {
      return { mealPlanCode: null, breakfastIncluded: false, allInclusive: false, addOns: [] };
    }
    const { getGuestEntitlements } = await import(
      "@/lib/services/guest-entitlements.service"
    );
    const ent = await getGuestEntitlements({ reservationId: session.reservationId });
    if (!ent) {
      return { mealPlanCode: null, breakfastIncluded: false, allInclusive: false, addOns: [] };
    }
    return {
      mealPlanCode: ent.mealPlanCode,
      breakfastIncluded: ent.breakfastIncluded,
      allInclusive: ent.allInclusive,
      addOns: ent.addOns,
      roomNumber: ent.roomNumber,
    };
  });
}

/** Wave E — bell inbox */
export async function listGuestAppMessages(token: string) {
  const session = await requireSession(token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const rows = await prisma.guestAppMessage.findMany({
      where: {
        organizationId: session.organizationId,
        OR: [
          { reservationGuestId: session.reservationGuestId },
          { reservationGuestId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function markGuestAppMessageRead(args: { token: string; messageId: string }) {
  const session = await requireSession(args.token);
  return runWithSatelliteTenant({ organizationId: session.organizationId }, async () => {
    const row = await prisma.guestAppMessage.findFirst({
      where: {
        id: args.messageId,
        organizationId: session.organizationId,
        OR: [
          { reservationGuestId: session.reservationGuestId },
          { reservationGuestId: null },
        ],
      },
    });
    if (!row) throw new GuestAppHttpError(404, "NOT_FOUND");
    const updated = await prisma.guestAppMessage.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    return { id: updated.id, readAt: updated.readAt?.toISOString() ?? null };
  });
}

export async function staffSendGuestAppMessage(args: {
  organizationId: string;
  reservationGuestId?: string | null;
  kind: "RECEPTION" | "CLINIC" | "MARKETING";
  body: string;
  actorUserId: string;
}) {
  const body = args.body.trim();
  if (!body) throw new GuestAppHttpError(400, "EMPTY");
  // Marketing must not invent clinical chart / ICD text (ADR / Wave E).
  if (args.kind === "MARKETING" && /diagnos|icd|\bchart\b/i.test(body)) {
    throw new GuestAppHttpError(400, "NO_CLINICAL_TEXT");
  }
  const row = await prisma.guestAppMessage.create({
    data: {
      organizationId: args.organizationId,
      reservationGuestId: args.reservationGuestId ?? null,
      kind: args.kind,
      body,
    },
  });
  await prisma.satelliteAuditLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.actorUserId,
        action: "GUEST_APP_MESSAGE_SEND",
        entityType: "GuestAppMessage",
        entityId: row.id,
        changesJson: JSON.stringify({ kind: args.kind }),
      },
    })
    .catch(() => undefined);
  return { id: row.id, kind: row.kind, createdAt: row.createdAt.toISOString() };
}
