import { z } from "zod";
import { financeExternalPurchase } from "@era/satellite-kit";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().min(0.0001),
      unitPrice: z.number().optional(),
    }),
  ),
  counterpartyId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return jsonError("Work order not found", 404);
    const body = bodySchema.parse(await req.json());
    const result = await financeExternalPurchase(
      { externalRef: `WO-${wo.code}`, lines: body.lines, counterpartyId: body.counterpartyId },
      { authHeader: req.headers.get("authorization") },
    );
    return jsonOk({ workOrderId: id, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
