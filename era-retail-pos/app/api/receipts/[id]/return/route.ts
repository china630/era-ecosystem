import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    bodySchema.parse(await req.json().catch(() => ({})));

    const original = await prisma.receipt.findUnique({
      where: { id },
      include: { lines: true, shift: true, outlet: true },
    });
    if (!original) return jsonError("Receipt not found", 404);
    if (original.status !== "PAID") {
      return jsonError("Only paid receipts can be returned", 400);
    }
    if (original.shift.status !== "OPEN") {
      return jsonError("Shift must be open to process a return", 400);
    }

    const amountNet = -Number(original.amountNet);
    const returnReceipt = await prisma.receipt.create({
      data: {
        outletId: original.outletId,
        registerId: original.registerId,
        shiftId: original.shiftId,
        status: "PAID",
        amountNet,
        paymentMethod: original.paymentMethod ?? "return",
        paidAt: new Date(),
        originalReceiptId: original.id,
        lines: {
          create: original.lines
            .filter((line) => line.lineStatus === "ACTIVE")
            .map((line) => ({
              description: `RETURN: ${line.description}`,
              qty: -line.qty,
              unitPrice: line.unitPrice,
              lineTotal: -Number(line.lineTotal),
              plu: line.plu,
              barcode: line.barcode,
              isWeighted: line.isWeighted,
              weightKg: line.weightKg,
              size: line.size,
              color: line.color,
              serial: line.serial,
              batch: line.batch,
              rxRequired: line.rxRequired,
              rxApprovedBy: line.rxApprovedBy,
              lineStatus: "ACTIVE",
            })),
        },
      },
      include: { lines: true },
    });

    const preset = resolveOutletPreset(original.outlet.preset);

    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: returnReceipt.outletId,
        registerId: returnReceipt.registerId,
        shiftId: returnReceipt.shiftId,
        receiptId: returnReceipt.id,
        originalReceiptId: original.id,
        preset,
        amountNet,
        currency: "AZN",
        paymentMethod: returnReceipt.paymentMethod ?? "return",
        lineCount: returnReceipt.lines.length,
        isReturn: true,
      },
    });

    return jsonOk({ originalReceiptId: original.id, returnReceipt }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
