import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  orderNumber: z.string(),
  buyerCounterpartyId: z.string(),
  amountNet: z.number().nonnegative(),
  lineCount: z.number().int().nonnegative().default(1),
});

export async function GET() {
  try {
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
      },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
