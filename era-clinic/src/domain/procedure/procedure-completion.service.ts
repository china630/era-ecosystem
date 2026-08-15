import { randomUUID } from "crypto";
import { SATELLITE_CLINIC_PROCEDURE_COMPLETED } from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  ProcedureAttendanceError,
  SYSTEM_ATTENDANCE_ACTOR,
  type AttendanceActor,
} from "@/domain/procedure/procedure-attendance.service";
import { resolveProcedureCharge, logProcedureCharge } from "@/domain/procedure/procedure-charge.service";

export async function completeProcedureOrder(
  orderId: string,
  actor: AttendanceActor,
  body: {
    consumableLines?: Array<{ sku: string; qty: number; description?: string }>;
    amountNet?: number;
    confirmOverQuota?: boolean;
  },
) {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { patientRef: true },
  });
  if (!order) throw new ProcedureAttendanceError("Procedure not found", "NOT_FOUND");
  if (order.status === "COMPLETED") return { ...order, overQuota: false, folioCharged: false };
  if (order.status === "CANCELLED" || order.status === "NO_SHOW") {
    throw new ProcedureAttendanceError(
      `Cannot complete from status ${order.status}`,
      "INVALID_TRANSITION",
    );
  }
  if (order.status !== "CHECKED_IN") {
    throw new ProcedureAttendanceError(
      "Complete requires CHECKED_IN (guest must check in first)",
      "INVALID_TRANSITION",
    );
  }

  const charge = await resolveProcedureCharge(order);
  const settings = await getSchedulingSettings();

  if (charge.overQuota && settings.procedureOverQuotaPolicy === "BLOCK") {
    throw new Error("Procedure quota exceeded — completion blocked");
  }
  if (
    charge.overQuota &&
    settings.procedureOverQuotaPolicy === "WARN_ONLY" &&
    !body.confirmOverQuota
  ) {
    throw new Error("Procedure quota exceeded — confirm to continue");
  }

  const amountNet = body.amountNet ?? charge.amountNet;
  const lines = body.consumableLines ?? [
    { sku: `PROC-${order.procedureCode}`, qty: 1, description: order.procedureName },
  ];

  const now = new Date();
  const updated = await prisma.procedureOrder.update({
    where: { id: orderId },
    data: {
      status: "COMPLETED",
      amountNet,
      completedAt: now,
      completedByUserId: actor.userId,
    },
    include: { patientRef: true },
  });

  await recordClinicAudit(
    { userId: actor.userId },
    "ProcedureOrder",
    orderId,
    "PROCEDURE_COMPLETE",
    { status: "COMPLETED", amountNet, overQuota: charge.overQuota },
  );

  await dispatchSatelliteEvent({
    type: SATELLITE_CLINIC_PROCEDURE_COMPLETED,
    globalPersonId: order.patientRef.globalPersonId ?? undefined,
    payload: {
      visitId: order.visitId ?? undefined,
      patientRef: order.patientRef.refCode,
      patientOrigin: order.patientOrigin,
      procedureCode: order.procedureCode,
      amountNet,
      currency: "AZN",
      lines,
      reservationId: order.reservationId ?? undefined,
      overQuota: charge.overQuota,
    },
  });

  const billingTarget = await resolveBillingTarget(order.patientOrigin);
  const shouldChargeFolio =
    billingTarget === "HOTEL_FOLIO" &&
    !!order.reservationId &&
    amountNet > 0 &&
    (!charge.overQuota || settings.procedureOverQuotaPolicy === "CHARGE_FOLIO");

  const ticketId = `clinic-proc-${order.id}`;
  if (shouldChargeFolio && order.reservationId) {
    await postHotelRoomCharge({
      reservationId: order.reservationId,
      amount: amountNet,
      description: charge.overQuota
        ? `Over-quota procedure ${order.procedureCode}`
        : `Procedure ${order.procedureCode}`,
      externalTicketId: ticketId,
    });
  }

  const logChannel = shouldChargeFolio
    ? "HOTEL_FOLIO"
    : settings.procedureOverQuotaPolicy === "BLOCK"
      ? "BLOCKED"
      : amountNet > 0 || charge.overQuota
        ? "LOCAL"
        : "WARN_ONLY";
  await logProcedureCharge({
    procedureOrderId: order.id,
    patientRefId: order.patientRefId,
    reservationId: order.reservationId,
    procedureCode: order.procedureCode,
    procedureName: order.procedureName,
    amountNet,
    overQuota: charge.overQuota,
    channel: logChannel,
    externalTicketId: shouldChargeFolio ? ticketId : null,
  });

  const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(/\/$/, "");
  await fetch(`${retailBase}/api/integration/stock-write-off`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "clinic",
      procedureOrderId: order.id,
      lines,
      correlationId: randomUUID(),
    }),
  }).catch(() => null);

  return { ...updated, overQuota: charge.overQuota, folioCharged: !!shouldChargeFolio };
}

/**
 * Auto-complete CHECKED_IN orders whose scheduled end has passed.
 * Triggers: nurse board lazy load + cron catch-all.
 */
export async function autoCompleteElapsedCheckedIn(now = new Date()): Promise<{
  completed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const candidates = await prisma.procedureOrder.findMany({
    where: { status: "CHECKED_IN" },
    include: {
      procedureType: { select: { durationMin: true } },
    },
    take: 200,
    orderBy: { scheduledAt: "asc" },
  });

  let completed = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const order of candidates) {
    const durationMin = order.procedureType?.durationMin ?? 15;
    const endsAt =
      order.endsAt ?? new Date(order.scheduledAt.getTime() + durationMin * 60_000);
    if (endsAt.getTime() > now.getTime()) continue;

    try {
      await completeProcedureOrder(order.id, SYSTEM_ATTENDANCE_ACTOR, {
        confirmOverQuota: true,
      });
      completed += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        id: order.id,
        error: err instanceof Error ? err.message : "auto-complete failed",
      });
    }
  }

  return { completed, failed, errors };
}
