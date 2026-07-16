import { randomUUID } from "crypto";
import { SATELLITE_CLINIC_PROCEDURE_COMPLETED } from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { useProcedureQuota } from "@/lib/sanatorium-scheduler.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  ProcedureAttendanceError,
  type AttendanceActor,
} from "@/domain/procedure/procedure-attendance.service";

const DEFAULT_OVER_QUOTA_AZN = 25;

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
      "Complete requires CHECKED_IN (guest must check in via QR first)",
      "INVALID_TRANSITION",
    );
  }

  let overQuota = false;
  if (order.reservationId) {
    const program = await prisma.programInstance.findFirst({
      where: { reservationId: order.reservationId },
    });
    if (program) {
      const quota = await useProcedureQuota({
        instanceId: program.id,
        procedureCode: order.procedureCode,
      });
      overQuota = quota.overQuota;
    }
  }

  const settings = await getSchedulingSettings();
  if (overQuota && settings.procedureOverQuotaPolicy === "BLOCK") {
    throw new Error("Procedure quota exceeded — completion blocked");
  }
  if (
    overQuota &&
    settings.procedureOverQuotaPolicy === "WARN_ONLY" &&
    !body.confirmOverQuota
  ) {
    throw new Error("Procedure quota exceeded — confirm to continue");
  }

  const lines = body.consumableLines ?? [
    { sku: `PROC-${order.procedureCode}`, qty: 1, description: order.procedureName },
  ];
  let amountNet = body.amountNet ?? Number(order.amountNet);
  if (overQuota && amountNet <= 0) {
    amountNet = DEFAULT_OVER_QUOTA_AZN;
  }

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
    { status: "COMPLETED", amountNet, overQuota },
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
      overQuota,
    },
  });

  const billingTarget = await resolveBillingTarget(order.patientOrigin);
  const shouldChargeFolio =
    billingTarget === "HOTEL_FOLIO" &&
    order.reservationId &&
    amountNet > 0 &&
    (!overQuota || settings.procedureOverQuotaPolicy === "CHARGE_FOLIO");

  if (shouldChargeFolio) {
    await postHotelRoomCharge({
      reservationId: order.reservationId!,
      amount: amountNet,
      description: overQuota
        ? `Over-quota procedure ${order.procedureCode}`
        : `Procedure ${order.procedureCode}`,
      externalTicketId: `clinic-proc-${order.id}`,
    });
  }

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

  return { ...updated, overQuota, folioCharged: shouldChargeFolio };
}
