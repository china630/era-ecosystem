import { z } from "zod";
import { SATELLITE_RETAIL_SHIFT_CLOSED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  shiftId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
      include: {
        register: { include: { outlet: true } },
        receipts: { where: { status: "PAID" } },
      },
    });
    if (!shift) return jsonError("Shift not found", 404);
    if (shift.status === "CLOSED") return jsonOk(shift);

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const totalSales = shift.receipts.reduce(
      (sum, receipt) => sum + Number(receipt.amountNet),
      0,
    );
    const receiptCount = shift.receipts.length;
    const preset = resolveOutletPreset(shift.register.outlet.preset);

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SHIFT_CLOSED,
      payload: {
        outletId: shift.register.outletId,
        registerId: shift.registerId,
        shiftId: shift.id,
        preset,
        totalSales,
        receiptCount: shift.receipts.length,
        currency: "AZN",
      },
    });

    return jsonOk({ ...closed, totalSales, receiptCount });
  } catch (err) {
    return handleRouteError(err);
  }
}
