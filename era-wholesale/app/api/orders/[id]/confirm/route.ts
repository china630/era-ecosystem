import { SATELLITE_WHOLESALE_ORDER_CONFIRMED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.b2BOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "CONFIRMED") return jsonOk(order);

    const confirmed = await prisma.b2BOrder.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_WHOLESALE_ORDER_CONFIRMED,
      payload: {
        orderId: confirmed.id,
        buyerCounterpartyId: confirmed.buyerCounterpartyId,
        amountNet: Number(confirmed.amountNet),
        currency: "AZN",
        lineCount: confirmed.lineCount,
      },
    });

    return jsonOk(confirmed);
  } catch (err) {
    return handleRouteError(err);
  }
}
