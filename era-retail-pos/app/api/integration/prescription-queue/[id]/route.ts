import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import {
  refundPrescriptionSale,
  ringPrescriptionSale,
  settlePrescription,
} from "@/lib/prescription-sale";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  action: z.enum(["paid", "dispense", "return"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const row = await prisma.prescriptionQueue.findUnique({ where: { id } });
    if (!row) return jsonError("Prescription not found", 404);

    if (body.action === "paid") {
      if (row.status !== "AWAITING_PAY") return jsonError("Payment already recorded", 409);
      await settlePrescription(row);
      if (!row.reservationId) {
        return jsonOk({ id, status: row.status, waitingForHotel: true });
      }
      const updated = await prisma.prescriptionQueue.update({
        where: { id },
        data: { status: "READY", paidAt: new Date() },
      });
      return jsonOk({ id, status: updated.status });
    }

    if (body.action === "dispense") {
      if (row.status !== "READY") {
        return jsonError("Dispense only after payment", 409);
      }
      const receiptId = await ringPrescriptionSale(row);
      const updated = await prisma.prescriptionQueue.update({
        where: { id },
        data: { status: "DISPENSED", dispensedAt: new Date(), receiptId },
      });
      return jsonOk({ id, status: updated.status, receiptId, lines: JSON.parse(row.linesJson) });
    }

    if (row.status !== "DISPENSED") {
      return jsonError("Return the goods before refunding money", 409);
    }
    await refundPrescriptionSale(row);
    const updated = await prisma.prescriptionQueue.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date() },
    });
    const money = row.reservationId ? "FOLIO" : "CASHIER";
    return jsonOk({ id, status: updated.status, refundChannel: money });
  } catch (err) {
    return handleRouteError(err);
  }
}
