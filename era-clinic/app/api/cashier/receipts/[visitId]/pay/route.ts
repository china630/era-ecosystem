import { z } from "zod";
import { fiscalize } from "@era/fiscal";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  shiftId: z.string(),
  paymentMethod: z.string().default("CASH"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  try {
    const { visitId } = await params;
    const body = bodySchema.parse(await req.json());

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { serviceLines: true, receipts: true },
    });
    if (!visit) return jsonError("Visit not found", 404);
    if (visit.patientOrigin === "IN_HOUSE") {
      return jsonError("In-house guest: settle at hotel reception", 400);
    }

    const { isWalkInDeferredToHub } = await import("@/lib/billing-router");
    if (await isWalkInDeferredToHub()) {
      return jsonError("Walk-in: pay at hotel Front Cash (settlement hub)", 400);
    }

    const paid = visit.receipts.find((r) => r.status === "PAID");
    if (paid) return jsonOk(paid);

    const amountNet = Number(visit.amountNet);
    const receipt = await prisma.clinicReceipt.create({
      data: {
        shiftId: body.shiftId,
        visitId,
        amountNet,
        status: "OPEN",
        lines: {
          create: visit.serviceLines.map((l) => ({
            serviceCode: l.serviceCode,
            description: l.description,
            amount: l.amount,
          })),
        },
      },
      include: { lines: true },
    });

    const fiscal = await fiscalize({
      documentRef: receipt.id,
      amount: amountNet,
      paymentMethod: body.paymentMethod,
    });

    const paidReceipt = await prisma.clinicReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "PAID",
        paymentMethod: body.paymentMethod,
        fiscalReceiptId: fiscal.receiptId,
        fiscalQrPayload: fiscal.qrPayload,
        paidAt: new Date(),
      },
      include: { lines: true },
    });

    return jsonOk({ receipt: paidReceipt, fiscal, settlementOnly: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
