import { z } from "zod";
import {
  fiscalizeForSatellite,
  isFiscalPaymentMethod,
  isFiscalSkipped,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { recalcWorkOrderTotals } from "@/lib/work-order-lines";

const bodySchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "cash", "card"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const method = body.paymentMethod.toUpperCase();

    const order = await prisma.workOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Work order not found", 404);
    if (order.paidAt) return jsonOk(order);

    await recalcWorkOrderTotals(id);
    const refreshed = await prisma.workOrder.findUnique({ where: { id } });
    if (!refreshed) return jsonError("Work order not found", 404);

    const amountAzn =
      Number(refreshed.laborAmount) + Number(refreshed.partsAmount);
    if (amountAzn <= 0) {
      return jsonError("Work order has no amount to settle", 400);
    }

    let fiscalNumber: string | null = null;
    if (isFiscalPaymentMethod(method)) {
      const outcome = await fiscalizeForSatellite(
        {
          documentRef: refreshed.id,
          amount: amountAzn,
          paymentMethod: method,
          registerRef: refreshed.code,
        },
        requestOrganizationId(),
      );
      if (!isFiscalSkipped(outcome)) {
        fiscalNumber = outcome.receiptId;
      }
    }

    const paid = await prisma.workOrder.update({
      where: { id },
      data: {
        paymentMethod: method,
        fiscalNumber,
        paidAt: new Date(),
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
