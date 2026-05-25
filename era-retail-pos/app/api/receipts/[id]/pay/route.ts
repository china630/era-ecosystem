import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { isRetailPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  paymentMethod: z.string().default("cash"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: true,
        outlet: true,
        register: true,
        shift: true,
      },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "PAID") return jsonOk(receipt);

    const paid = await prisma.receipt.update({
      where: { id },
      data: {
        status: "PAID",
        paymentMethod: body.paymentMethod,
        paidAt: new Date(),
      },
      include: { lines: true },
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
    const amountNet = Number(receipt.amountNet);

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: receipt.outletId,
        registerId: receipt.registerId,
        shiftId: receipt.shiftId,
        receiptId: receipt.id,
        preset,
        amountNet,
        currency: "AZN",
        paymentMethod: body.paymentMethod,
        lineCount: receipt.lines.length,
      },
    });

    return jsonOk(paid);
  } catch (err) {
    return handleRouteError(err);
  }
}
