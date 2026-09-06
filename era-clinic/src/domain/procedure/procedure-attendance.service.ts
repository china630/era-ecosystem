import type { ProcedureCheckInChannel, ProcedureOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { rescheduleProcedureOrder } from "@/lib/procedure-scheduling.service";
import {
  addMinutes,
  isWithinCheckInWindow,
  isWithinDynamicCheckInWindow,
  resolveCheckInDeadline,
} from "@/domain/procedure/procedure-check-in-window";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  resolveProcedureCharge,
  postProcedureFolioCharge,
  logProcedureCharge,
} from "@/domain/procedure/procedure-charge.service";
import {
  extraNeedsPaperTicket,
  isClinicElektrawebDualRun,
} from "@/domain/procedure/extra-ticket";

export {
  isWithinCheckInWindow,
  addMinutes,
  resolveCheckInDeadline,
  isWithinDynamicCheckInWindow,
} from "@/domain/procedure/procedure-check-in-window";

export class ProcedureAttendanceError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "INVALID_TRANSITION"
      | "QR_REQUIRED"
      | "QR_MISMATCH"
      | "CODE_REQUIRED"
      | "CODE_MISMATCH"
      | "CODE_DISABLED"
      | "CHECK_IN_MODE_MISMATCH"
      | "NOT_IN_CHECKIN_WINDOW"
      | "RESOURCE_BUSY"
      | "OVERRIDE_FORBIDDEN"
      | "TICKET_REQUIRED",
  ) {
    super(message);
    this.name = "ProcedureAttendanceError";
  }
}

export type AttendanceActor = {
  userId: string;
  canOverrideCheckIn: boolean;
};

async function getGrace() {
  try {
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    const derivedMode: "QR" | "MANUAL" =
      tenant?.checkInRequiresQr === false ? "MANUAL" : "QR";
    const procedureCheckInMode: "QR" | "CODE" | "MANUAL" =
      tenant?.procedureCheckInMode ?? derivedMode;
    return {
      beforeMin: tenant?.procedureCheckInGraceBeforeMin ?? 5,
      afterMin: tenant?.procedureCheckInGraceAfterMin ?? 15,
      checkInRequiresQr: procedureCheckInMode === "QR",
      procedureCheckInMode,
    };
  } catch {
    return {
      beforeMin: 5,
      afterMin: 15,
      checkInRequiresQr: true,
      procedureCheckInMode: "QR",
    };
  }
}

/** Effective endsAt for an order (fallback: scheduledAt + type duration). */
export async function resolveOrderEndsAt(order: {
  id: string;
  scheduledAt: Date;
  endsAt: Date | null;
  procedureTypeId?: string | null;
}): Promise<Date> {
  if (order.endsAt) return order.endsAt;
  let durationMin = 15;
  if (order.procedureTypeId) {
    const pt = await prisma.procedureType.findUnique({
      where: { id: order.procedureTypeId },
      select: { durationMin: true },
    });
    if (pt?.durationMin) durationMin = pt.durationMin;
  }
  return addMinutes(order.scheduledAt, durationMin);
}

/**
 * True when an active booking overlaps (endsAt, endsAt+gap] on this resource
 * (the planned turnover gap into the next slot).
 */
export async function isNextGapOccupied(
  resourceId: string | null | undefined,
  endsAt: Date,
  gapMinutes: number,
  excludeOrderId?: string,
): Promise<boolean> {
  if (!resourceId || gapMinutes <= 0) return false;
  const gapEnd = addMinutes(endsAt, gapMinutes);
  const hit = await prisma.resourceBooking.findFirst({
    where: {
      resourceId,
      startsAt: { lt: gapEnd },
      endsAt: { gt: endsAt },
      ...(excludeOrderId ? { procedureOrderId: { not: excludeOrderId } } : {}),
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Unified check-in window for QR / MANUAL / OVERRIDE:
 * scheduledAt - beforeMin ... endsAt, plus gap grace only when next resource slot is free.
 */
export async function assertCheckInWindow(
  order: {
    id: string;
    scheduledAt: Date;
    endsAt: Date | null;
    resourceId?: string | null;
    procedureTypeId?: string | null;
  },
  _channel: ProcedureCheckInChannel,
  now = new Date(),
) {
  const { beforeMin } = await getGrace();
  const gap = await resolveOrderResourceGap(order.procedureTypeId);
  const endsAt = await resolveOrderEndsAt(order);
  const nextOccupied = await isNextGapOccupied(
    order.resourceId,
    endsAt,
    gap,
    order.id,
  );
  if (
    !isWithinDynamicCheckInWindow(
      order.scheduledAt,
      endsAt,
      now,
      beforeMin,
      gap,
      nextOccupied,
    )
  ) {
    const deadline = resolveCheckInDeadline(endsAt, gap, nextOccupied);
    throw new ProcedureAttendanceError(
      `Check-in only allowed from ${beforeMin} min before start until ${deadline.toISOString()} (endsAt${nextOccupied ? "" : ` + ${gap}m gap`})`,
      "NOT_IN_CHECKIN_WINDOW",
    );
  }
}

/** Client/API helper: whether check-in is still open for this order. */
export async function getCheckInOpenState(
  order: {
    id: string;
    scheduledAt: Date;
    endsAt: Date | null;
    resourceId?: string | null;
    procedureTypeId?: string | null;
    status: string;
  },
  now = new Date(),
): Promise<{ open: boolean; deadline: Date; endsAt: Date; resourceGapMinutes: number }> {
  const { beforeMin } = await getGrace();
  const gap = await resolveOrderResourceGap(order.procedureTypeId);
  const endsAt = await resolveOrderEndsAt(order);
  const nextOccupied = await isNextGapOccupied(
    order.resourceId,
    endsAt,
    gap,
    order.id,
  );
  const deadline = resolveCheckInDeadline(endsAt, gap, nextOccupied);
  const open =
    order.status === "SCHEDULED" &&
    isWithinDynamicCheckInWindow(
      order.scheduledAt,
      endsAt,
      now,
      beforeMin,
      gap,
      nextOccupied,
    );
  return { open, deadline, endsAt, resourceGapMinutes: gap };
}

async function resolveOrderResourceGap(
  procedureTypeId?: string | null,
): Promise<number> {
  if (!procedureTypeId) return 5;
  const pt = await prisma.procedureType.findUnique({
    where: { id: procedureTypeId },
    select: { resourceGapMinutes: true },
  });
  return pt?.resourceGapMinutes ?? 5;
}

async function resolvePatientFromQr(qrToken: string): Promise<string> {
  const payload = await verifyGuestQrToken(qrToken.trim());
  if (!payload?.globalPersonId) {
    throw new ProcedureAttendanceError("Invalid or expired guest QR token", "QR_MISMATCH");
  }
  const patient = await prisma.patientRef.findFirst({
    where: { globalPersonId: payload.globalPersonId },
  });
  if (!patient) {
    throw new ProcedureAttendanceError("Guest not registered in clinic", "QR_MISMATCH");
  }
  return patient.id;
}

async function assertResourceFreeForCheckIn(order: ProcedureOrder) {
  if (!order.resourceId) return;
  const resource = await prisma.resource.findUnique({ where: { id: order.resourceId } });
  const capacity = resource?.capacity ?? 1;
  const busy = await prisma.procedureOrder.count({
    where: {
      resourceId: order.resourceId,
      status: "CHECKED_IN",
      id: { not: order.id },
    },
  });
  if (busy >= capacity) {
    throw new ProcedureAttendanceError(
      "Resource already has a checked-in procedure",
      "RESOURCE_BUSY",
    );
  }
}

export async function checkInProcedureOrder(
  orderId: string,
  actor: AttendanceActor,
  input: { qrToken?: string; accessCode?: string; overrideReason?: string },
) {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (order.status !== "SCHEDULED") {
    throw new ProcedureAttendanceError(
      `Cannot check in from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }

  let channel: ProcedureCheckInChannel;
  let overrideReason: string | null = null;
  const grace = await getGrace();
  const mode = grace.procedureCheckInMode;

  if (input.overrideReason?.trim()) {
    if (!actor.canOverrideCheckIn) {
      throw new ProcedureAttendanceError(
        "Check-in override requires doctor or clinic admin",
        "OVERRIDE_FORBIDDEN",
      );
    }
    channel = "OVERRIDE";
    overrideReason = input.overrideReason.trim();
  } else if (input.accessCode?.trim()) {
    if (mode !== "CODE") {
      throw new ProcedureAttendanceError(
        "Code check-in is disabled for this clinic mode",
        "CODE_DISABLED",
      );
    }
    const normalized = input.accessCode.trim().toUpperCase();
    if (!order.accessCode || order.accessCode.toUpperCase() !== normalized) {
      throw new ProcedureAttendanceError(
        "Access code does not match this procedure",
        "CODE_MISMATCH",
      );
    }
    channel = "CODE";
  } else if (input.qrToken?.trim()) {
    if (mode !== "QR") {
      throw new ProcedureAttendanceError(
        "QR check-in is disabled for this clinic mode",
        "CHECK_IN_MODE_MISMATCH",
      );
    }
    const patientRefId = await resolvePatientFromQr(input.qrToken);
    if (patientRefId !== order.patientRefId) {
      throw new ProcedureAttendanceError(
        "QR guest does not match this procedure patient",
        "QR_MISMATCH",
      );
    }
    channel = "QR";
  } else if (mode === "MANUAL") {
    channel = "MANUAL";
  } else if (mode === "CODE") {
    throw new ProcedureAttendanceError("Access code required for check-in", "CODE_REQUIRED");
  } else {
    throw new ProcedureAttendanceError(
      "Guest QR required for check-in (or override with reason)",
      "QR_REQUIRED",
    );
  }

  await assertCheckInWindow(order, channel);
  await assertResourceFreeForCheckIn(order);

  const charge = await resolveProcedureCharge(order, { burnQuota: false });
  if (
    extraNeedsPaperTicket({
      amountNet: charge.amountNet,
      inPackage: order.inPackage === true,
      packageIncluded: order.inPackage === true,
    }) &&
    !order.extraTicketIssuedAt
  ) {
    throw new ProcedureAttendanceError(
      "Extra procedure requires an issued ticket (3 copies) before check-in",
      "TICKET_REQUIRED",
    );
  }

  const now = new Date();
  const updated = await prisma.procedureOrder.update({
    where: { id: orderId },
    data: {
      status: "CHECKED_IN",
      checkedInAt: now,
      checkedInByUserId: actor.userId,
      checkInChannel: channel,
      checkInOverrideReason: overrideReason,
    },
    include: { patientRef: true },
  });

  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_CHECK_IN",
    {
      before: { status: order.status },
      after: {
        status: "CHECKED_IN",
        checkInChannel: channel,
        checkInOverrideReason: overrideReason,
      },
    },
  );

  return updated;
}

export async function markProcedureNoShow(orderId: string, actor: AttendanceActor) {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { patientRef: true },
  });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (order.status !== "SCHEDULED") {
    throw new ProcedureAttendanceError(
      `Cannot mark no-show from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }

  const charge = await resolveProcedureCharge(order);

  const now = new Date();
  // Keep ResourceBooking — NO_SHOW stays visible on the matrix as evidence.
  const updated = await prisma.procedureOrder.update({
    where: { id: orderId },
    data: {
      status: "NO_SHOW",
      noShowAt: now,
      noShowByUserId: actor.userId,
      amountNet: charge.amountNet,
    },
    include: { patientRef: true, resourceBooking: true },
  });

  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_NO_SHOW",
    {
      before: { status: "SCHEDULED" },
      after: {
        status: "NO_SHOW",
        overQuota: charge.overQuota,
        amountNet: charge.amountNet,
      },
    },
  );

  const ticketId = `clinic-noshow-${order.id}`;
  if (
    charge.shouldChargeFolio &&
    order.reservationId &&
    !(await isClinicElektrawebDualRun()) &&
    !order.extraTicketIssuedAt
  ) {
    await postProcedureFolioCharge({
      reservationId: order.reservationId,
      amount: charge.amountNet,
      description: charge.overQuota
        ? `Over-quota procedure no-show ${order.procedureCode}`
        : `Procedure no-show ${order.procedureCode}`,
      externalTicketId: ticketId,
    });
  }

  const settings = await getSchedulingSettings();
  const logChannel = charge.shouldChargeFolio
    ? "HOTEL_FOLIO"
    : settings.procedureOverQuotaPolicy === "BLOCK"
      ? "BLOCKED"
      : charge.overQuota || charge.amountNet > 0
        ? "LOCAL"
        : "WARN_ONLY";
  await logProcedureCharge({
    procedureOrderId: order.id,
    patientRefId: order.patientRefId,
    reservationId: order.reservationId,
    procedureCode: order.procedureCode,
    procedureName: order.procedureName,
    amountNet: charge.amountNet,
    overQuota: charge.overQuota,
    channel: logChannel,
    externalTicketId: charge.shouldChargeFolio ? ticketId : null,
  });

  return { ...updated, overQuota: charge.overQuota, folioCharged: charge.shouldChargeFolio };
}

export async function cancelProcedureOrder(
  orderId: string,
  actor: AttendanceActor,
  reason?: string,
) {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { resourceBooking: true },
  });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (!["SCHEDULED", "CHECKED_IN"].includes(order.status)) {
    throw new ProcedureAttendanceError(
      `Cannot cancel from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (order.resourceBooking) {
      await tx.resourceBooking.delete({ where: { id: order.resourceBooking.id } });
    }
    return tx.procedureOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledByUserId: actor.userId,
        cancelReason: reason?.trim() || null,
        manuallyAdjusted: true,
      },
      include: { patientRef: true },
    });
  });

  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_CANCEL",
    { before: { status: order.status }, after: { status: "CANCELLED", cancelReason: reason ?? null } },
  );

  return updated;
}

export async function receptionRescheduleProcedure(
  orderId: string,
  scheduledAt: Date,
  actor: AttendanceActor,
  opts?: { resourceId?: string },
) {
  const updated = await rescheduleProcedureOrder(orderId, scheduledAt, opts);
  await prisma.procedureOrder.update({
    where: { id: orderId },
    data: { manuallyAdjusted: true },
  });
  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_RESCHEDULE",
    {
      after: {
        scheduledAt: updated.scheduledAt.toISOString(),
        resourceId: updated.resourceId,
        manuallyAdjusted: true,
      },
    },
  );
  return updated;
}

export function mapAttendanceHttpStatus(err: ProcedureAttendanceError): number {
  switch (err.code) {
    case "NOT_FOUND":
      return 404;
    case "INVALID_TRANSITION":
    case "QR_REQUIRED":
    case "QR_MISMATCH":
    case "CODE_REQUIRED":
    case "CODE_MISMATCH":
    case "NOT_IN_CHECKIN_WINDOW":
    case "RESOURCE_BUSY":
    case "TICKET_REQUIRED":
      return 409;
    case "CODE_DISABLED":
    case "CHECK_IN_MODE_MISMATCH":
      return 400;
    case "OVERRIDE_FORBIDDEN":
      return 403;
    default:
      return 400;
  }
}

export async function listOverdueScheduledProcedures(now = new Date()) {
  const { afterMin } = await getGrace();
  const cutoff = addMinutes(now, -afterMin);
  return prisma.procedureOrder.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lt: cutoff },
    },
    include: { patientRef: true },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
}

export const SYSTEM_ATTENDANCE_ACTOR: AttendanceActor = {
  userId: "system:cron",
  canOverrideCheckIn: false,
};
