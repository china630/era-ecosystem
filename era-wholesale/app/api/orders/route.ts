import { z } from "zod";
import { jsonOk, handleRouteError, assertWholesaleEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  orderNumber: z.string(),
  buyerCounterpartyId: z.string(),
  amountNet: z.number().nonnegative(),
  lineCount: z.number().int().nonnegative().default(1),
  /** B2B = invoice/credit; COUNTER = walk-in cash sale (use POST .../pay). */
  channel: z.enum(["B2B", "COUNTER"]).optional(),
  /** > 0 = on-account; trade credit grant required when Finance SKU is on. */
  paymentTermDays: z.number().int().min(0).max(365).optional(),
});

export async function GET() {
  try {
    await assertWholesaleEntitled();
    const orders = await prisma.b2BOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const order = await prisma.b2BOrder.create({
      data: {
        orderNumber: body.orderNumber,
        buyerCounterpartyId: body.buyerCounterpartyId,
        amountNet: body.amountNet,
        lineCount: body.lineCount,
        channel: body.channel ?? "B2B",
        ...(body.paymentTermDays != null
          ? { paymentTermDays: body.paymentTermDays }
          : {}),
      },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
