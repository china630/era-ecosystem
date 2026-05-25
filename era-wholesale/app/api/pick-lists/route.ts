import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  skuCode: z.string(),
  qtyOrdered: z.number().int().positive(),
});

const createSchema = z.object({
  orderNumber: z.string(),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  try {
    const pickLists = await prisma.pickList.findMany({
      include: { order: true, lines: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(pickLists);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const order = await prisma.b2BOrder.findUnique({
      where: { orderNumber: body.orderNumber },
    });
    if (!order) return jsonError("Order not found", 404);

    const existing = await prisma.pickList.findUnique({
      where: { orderId: order.id },
    });
    if (existing) return jsonOk(existing);

    const pickList = await prisma.pickList.create({
      data: {
        orderId: order.id,
        lines: {
          create: body.lines.map((line) => ({
            skuCode: line.skuCode,
            qtyOrdered: line.qtyOrdered,
          })),
        },
      },
      include: { order: true, lines: true },
    });
    return jsonOk(pickList, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
