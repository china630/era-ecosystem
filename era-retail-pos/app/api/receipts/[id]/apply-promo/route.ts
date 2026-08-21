import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { receiptPromoDenied } from "@/lib/receipt-status-gates";
import { resolvePromo } from "@/lib/receipt-promo";
import { prisma } from "@/lib/prisma";

type ReceiptWithLines = Prisma.ReceiptGetPayload<{ include: { lines: true } }>;

const bodySchema = z.object({
  promoCode: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertRetailEntitled();
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const receipt = (await prisma.receipt.findUnique({
      where: { id },
      include: { lines: true },
    })) as ReceiptWithLines | null;
    if (!receipt) return jsonError("Receipt not found", 404);
    const promoDenied = receiptPromoDenied(receipt.status);
    if (promoDenied) return jsonError(promoDenied, 400);

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
