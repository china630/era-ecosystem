import { SATELLITE_AUTO_WORK_ORDER_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.workOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Work order not found", 404);
    if (order.status === "COMPLETED") return jsonOk(order);

    const completed = await prisma.workOrder.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_AUTO_WORK_ORDER_COMPLETED,
      payload: {
        workOrderId: completed.id,
        vehiclePlate: completed.vehiclePlate ?? undefined,
        laborAmount: Number(completed.laborAmount),
        partsAmount: Number(completed.partsAmount),
        currency: "AZN",
      },
    });

    return jsonOk(completed);
  } catch (err) {
    return handleRouteError(err);
  }
}
