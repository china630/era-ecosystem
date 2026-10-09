import { z } from "zod";
import { SATELLITE_RETAIL_SALE_COMPLETED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { isRetailPreset } from "@/lib/retail-preset";
import { enterRequestTenant } from "@/lib/request-organization";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  organizationId: z.string().min(1),
});

function verifyBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    if (!verifyBridge(request)) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await request.json());
    enterRequestTenant(body.organizationId);

    const receipt = await prisma.receipt.findUnique({
      where: { id: body.sourceRef },
      include: { lines: true, outlet: true },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status === "PAID") return jsonOk({ ok: true, alreadySettled: true });
    if (receipt.status === "VOID") return jsonError("Receipt is void", 409);

    const storedPendingIds = receipt.hubPendingIds?.trim() ?? "";
    if (storedPendingIds.startsWith("[")) {
      const parsed = JSON.parse(storedPendingIds) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const left = ids.filter((id) => id !== body.pendingId);
      if (left.length > 0) {
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: { hubPendingIds: JSON.stringify(left) },
        });
        return jsonOk({ ok: true, waiting: left.length });
      }
    }

    const paid = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: body.paymentMethod?.trim() || receipt.paymentMethod,
        fiscalNumber: body.fiscalReceiptId ?? receipt.fiscalNumber,
        settlementChannel: "HOTEL_HUB",
        hubPendingIds: null,
      },
    });

    const presetRaw = receipt.outlet.preset ?? "grocery";
    const preset = isRetailPreset(presetRaw) ? presetRaw : "grocery";
    await dispatchSatelliteEvent({
      type: SATELLITE_RETAIL_SALE_COMPLETED,
      payload: {
        outletId: receipt.outletId,
        registerId: receipt.registerId,
        shiftId: receipt.shiftId,
        receiptId: receipt.id,
        preset,
        amountNet: Number(receipt.amountNet),
        currency: "AZN",
        paymentMethod: paid.paymentMethod ?? body.paymentMethod ?? "CASH",
        lineCount: receipt.lines.length,
        customerPhone: receipt.customerPhone ?? undefined,
        loyaltyRef: receipt.loyaltyRef ?? undefined,
        promoCode: receipt.promoCode ?? undefined,
      },
    });

    return jsonOk({ ok: true, receiptId: receipt.id, settled: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
