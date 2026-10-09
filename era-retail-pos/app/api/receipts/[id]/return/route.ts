import { Prisma, type ReceiptLine } from "@prisma/client";
import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { departmentFinanceEventsSilenced } from "@era/satellite-kit";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { postHotelSettlementPending, postRoomCharge } from "@/lib/pms-bridge-client";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

type PaidReceiptForReturn = Prisma.ReceiptGetPayload<{
  include: { lines: true; shift: true; outlet: true };
}>;

const bodySchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const { id } = await params;
    bodySchema.parse(await req.json().catch(() => ({})));

    const original = (await prisma.receipt.findUnique({
      where: { id },
      include: { lines: true, shift: true, outlet: true },
    })) as PaidReceiptForReturn | null;
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
    const orgId = requestOrganizationId();
    if (orgId && (await departmentFinanceEventsSilenced(orgId))) {
      const lines = returnReceipt.lines.filter((line: ReceiptLine) => line.lineStatus === "ACTIVE");
      for (const line of lines) {
        const sku = line.plu?.trim();
        if (!sku) return jsonError(`Finance SKU is required for ${line.description}`, 400);
        if (original.reservationId || original.roomNumber) {
          const charge = await postRoomCharge(
            {
              reservationId: original.reservationId ?? undefined,
              roomNumber: original.roomNumber ?? undefined,
              revenueCode: "RETAIL",
              amount: Number(line.lineTotal),
              qty: line.qty,
              productSku: sku,
              description: line.description,
              outletCode: original.outlet.code,
              externalTicketId: `return:${returnReceipt.id}:${line.id}`,
            },
            `return:${returnReceipt.id}:${line.id}`,
          );
          if (!charge.ok) {
            return jsonError(`Hotel folio return failed: ${charge.status}`, 502);
          }
        } else {
          await postHotelSettlementPending({
            sourceRef: returnReceipt.id,
            amount: Number(line.lineTotal),
            description: line.description,
            payerLabel: original.outlet.code,
            idempotencyKey: `retail-return-${returnReceipt.id}-${line.id}`,
            sku,
            qty: line.qty,
            revenueCode: "RETAIL",
          });
        }
      }
      return jsonOk({ originalReceiptId: original.id, returnReceipt }, 201);
    }

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
