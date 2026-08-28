import { SATELLITE_WHOLESALE_ORDER_CONFIRMED } from "@era/contracts";
import {
  fiscalizeForSatellite,
  isFiscalPaymentMethod,
  isFiscalSkipped,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "cash", "card"]),
});

/** Cash-and-carry / retail counter settlement for walk-in buyers (channel=COUNTER). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const method = body.paymentMethod.toUpperCase();

    const order = await prisma.b2BOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Order not found", 404);
    if (order.channel !== "COUNTER") {
      return jsonError("Fiscal pay is only for counter (walk-in) orders", 400);
    }
    if (order.paidAt) return jsonOk(order);

    const amountNet = Number(order.amountNet);
    if (amountNet <= 0) {
      return jsonError("Order has no amount to settle", 400);
    }

    let fiscalNumber: string | null = null;
    if (isFiscalPaymentMethod(method)) {
      const outcome = await fiscalizeForSatellite(
        {
          documentRef: order.id,
          amount: amountNet,
          paymentMethod: method,
          outletCode: "COUNTER",
        },
        requestOrganizationId(),
      );
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
    }

    const paid = await prisma.b2BOrder.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        paymentMethod: method,
        fiscalNumber,
        paidAt: new Date(),
      },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_WHOLESALE_ORDER_CONFIRMED,
      payload: {
        orderId: paid.id,
        buyerCounterpartyId: paid.buyerCounterpartyId,
        amountNet,
        currency: "AZN",
        lineCount: paid.lineCount,
        channel: "COUNTER",
        paymentMethod: method,
        fiscalNumber: fiscalNumber ?? undefined,
      },
    });

    return jsonOk({
      ...paid,
      fiscalSkipped: fiscalNumber === null && isFiscalPaymentMethod(method),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
