import { financeStockCheck } from "@era/satellite-kit";
import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { lineAmount, recalcWorkOrderTotals } from "@/lib/work-order-lines";
import { workOrderMutationDenied } from "@/lib/work-order-status";

const createSchema = z.object({
  description: z.string().min(1),
  sku: z.string().optional(),
  qty: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const lines = await prisma.workOrderPartLine.findMany({
      where: { workOrderId: id },
      orderBy: { sortOrder: "asc" },
    });
    return jsonOk(lines);
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
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return jsonError("Work order not found", 404);
    const closed = workOrderMutationDenied(wo.status);
    if (closed) return jsonError(closed, 400);
    const body = createSchema.parse(await req.json());
    let stockCheck: Record<string, unknown> | undefined;
    if (body.sku?.trim()) {
      try {
        stockCheck = (await financeStockCheck(
          { sku: body.sku.trim(), actualQty: body.qty },
          { authHeader: req.headers.get("authorization") },
        )) as Record<string, unknown>;
      } catch {
        stockCheck = { sku: body.sku, match: true, source: "stub" };
      }
    }
    const amountAzn = lineAmount(body.qty, body.unitPrice);
    await prisma.workOrderPartLine.create({
      data: {
        workOrderId: id,
        sku: body.sku,
        description: body.description,
        qty: body.qty,
        unitPrice: body.unitPrice,
        amountAzn,
      },
    });
    const updated = await recalcWorkOrderTotals(id);
    return jsonOk({ ...updated, stockCheck }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
