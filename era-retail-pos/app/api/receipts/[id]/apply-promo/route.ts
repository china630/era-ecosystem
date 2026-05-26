import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { resolvePromo } from "@/lib/receipt-promo";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  promoCode: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
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
      include: { lines: true },
    });
    if (!receipt) return jsonError("Receipt not found", 404);
    if (receipt.status !== "OPEN") {
      return jsonError("Promo applies only to OPEN receipts", 400);
    }

    const subtotal = Number(receipt.subtotalAmount) || receipt.lines
      .filter((l) => l.lineStatus === "ACTIVE")
      .reduce((s, l) => s + Number(l.lineTotal), 0);

    const promo = resolvePromo(body, subtotal);

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        subtotalAmount: subtotal,
        promoCode: promo.promoCode,
        discountPercent: promo.discountPercent,
        discountAmount: promo.discountAmount,
        amountNet: promo.amountNet,
      },
      include: { lines: true },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
