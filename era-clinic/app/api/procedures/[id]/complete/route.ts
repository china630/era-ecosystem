import { randomUUID } from "crypto";
import { SATELLITE_CLINIC_PROCEDURE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { useProcedureQuota } from "@/lib/sanatorium-scheduler.service";
import { prisma } from "@/lib/prisma";

const DEFAULT_OVER_QUOTA_AZN = 25;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      consumableLines?: Array<{ sku: string; qty: number; description?: string }>;
      amountNet?: number;
      confirmOverQuota?: boolean;
    };

    const order = await prisma.procedureOrder.findUnique({
      where: { id },
      include: { patientRef: true },
    });
    if (!order) return jsonError("Procedure not found", 404);
    if (order.status === "COMPLETED") return jsonOk(order);
    if (order.status === "CANCELLED") {
      return jsonError("Procedure is cancelled", 400);
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
      return jsonError("Procedure quota exceeded — completion blocked", 409);
    }
    if (
      overQuota &&
      settings.procedureOverQuotaPolicy === "WARN_ONLY" &&
      !body.confirmOverQuota
    ) {
      return jsonError("Procedure quota exceeded — confirm to continue", 409);
    }

    const lines = body.consumableLines ?? [
      { sku: `PROC-${order.procedureCode}`, qty: 1, description: order.procedureName },
    ];
    let amountNet = body.amountNet ?? Number(order.amountNet);
    if (overQuota && amountNet <= 0) {
      amountNet = DEFAULT_OVER_QUOTA_AZN;
    }

    const updated = await prisma.procedureOrder.update({
      where: { id },
      data: { status: "COMPLETED", amountNet },
      include: { patientRef: true },
    });

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

    const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(
      /\/$/,
      "",
    );
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

    return jsonOk({ ...updated, overQuota, folioCharged: shouldChargeFolio });
  } catch (err) {
    return handleRouteError(err);
  }
}
