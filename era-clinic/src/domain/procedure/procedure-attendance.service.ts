import type { ProcedureCheckInChannel, ProcedureOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { rescheduleProcedureOrder } from "@/lib/procedure-scheduling.service";
import {
  addMinutes,
  isWithinCheckInWindow,
} from "@/domain/procedure/procedure-check-in-window";

export { isWithinCheckInWindow, addMinutes } from "@/domain/procedure/procedure-check-in-window";

export class ProcedureAttendanceError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "INVALID_TRANSITION"
      | "QR_REQUIRED"
      | "QR_MISMATCH"
      | "NOT_IN_CHECKIN_WINDOW"
      | "RESOURCE_BUSY"
      | "OVERRIDE_FORBIDDEN",
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
    return {
      beforeMin: tenant?.procedureCheckInGraceBeforeMin ?? 5,
      afterMin: tenant?.procedureCheckInGraceAfterMin ?? 15,
    };
  } catch {
    return { beforeMin: 5, afterMin: 15 };
  }
}

export async function assertCheckInWindow(scheduledAt: Date, now = new Date()) {
  const { beforeMin, afterMin } = await getGrace();
  if (!isWithinCheckInWindow(scheduledAt, now, beforeMin, afterMin)) {
    throw new ProcedureAttendanceError(
      `Check-in only allowed from ${beforeMin} min before to ${afterMin} min after scheduled time`,
      "NOT_IN_CHECKIN_WINDOW",
    );
  }
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
  input: { qrToken?: string; overrideReason?: string },
) {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (order.status !== "SCHEDULED") {
    throw new ProcedureAttendanceError(
      `Cannot check in from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }

  await assertCheckInWindow(order.scheduledAt);

  let channel: ProcedureCheckInChannel;
  let overrideReason: string | null = null;

  if (input.overrideReason?.trim()) {
    if (!actor.canOverrideCheckIn) {
      throw new ProcedureAttendanceError(
        "Check-in override requires doctor or clinic admin",
        "OVERRIDE_FORBIDDEN",
      );
    }
    channel = "OVERRIDE";
    overrideReason = input.overrideReason.trim();
  } else if (input.qrToken?.trim()) {
    const patientRefId = await resolvePatientFromQr(input.qrToken);
    if (patientRefId !== order.patientRefId) {
      throw new ProcedureAttendanceError(
        "QR guest does not match this procedure patient",
        "QR_MISMATCH",
      );
    }
    channel = "QR";
  } else {
    throw new ProcedureAttendanceError(
      "Guest QR required for check-in (or override with reason)",
      "QR_REQUIRED",
    );
  }

  await assertResourceFreeForCheckIn(order);

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
        status: updated.status,
        checkInChannel: channel,
        checkInOverrideReason: overrideReason,
      },
    },
  );

  return updated;
}

export async function markProcedureNoShow(orderId: string, actor: AttendanceActor) {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (order.status !== "SCHEDULED") {
    throw new ProcedureAttendanceError(
      `Cannot mark no-show from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.procedureOrder.update({
      where: { id: orderId },
      data: {
        status: "NO_SHOW",
        noShowAt: now,
        noShowByUserId: actor.userId,
      },
      include: { patientRef: true, resourceBooking: true },
    });
    if (row.resourceBooking) {
      await tx.resourceBooking.delete({ where: { id: row.resourceBooking.id } });
    }
    return row;
  });

  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_NO_SHOW",
    { before: { status: "SCHEDULED" }, after: { status: "NO_SHOW" } },
  );

  return updated;
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
    case "NOT_IN_CHECKIN_WINDOW":
    case "RESOURCE_BUSY":
      return 409;
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
