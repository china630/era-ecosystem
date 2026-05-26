import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ttnNumber: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.b2BOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Order not found", 404);
    return jsonOk({
      orderId: order.id,
      orderNumber: order.orderNumber,
      ttnNumber: order.ttnNumber,
      ttnIssuedAt: order.ttnIssuedAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const order = await prisma.b2BOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Order not found", 404);
    const ttnNumber =
      body.ttnNumber?.trim() ||
      `TTN-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
    const updated = await prisma.b2BOrder.update({
      where: { id },
      data: { ttnNumber, ttnIssuedAt: new Date() },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
