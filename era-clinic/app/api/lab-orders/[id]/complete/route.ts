import { SATELLITE_CLINIC_LAB_ORDER_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (order.status === "COMPLETED") return jsonOk(order);

    const completed = await prisma.labOrder.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { patientRef: true },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_LAB_ORDER_COMPLETED,
      payload: {
        labOrderId: completed.id,
        patientRef: completed.patientRef.refCode,
        testCode: completed.testCode,
        amountNet: Number(completed.amountNet),
        currency: "AZN",
      },
    });

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
