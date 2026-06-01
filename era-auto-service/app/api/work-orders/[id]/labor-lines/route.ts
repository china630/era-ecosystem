import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { lineAmount, recalcWorkOrderTotals } from "@/lib/work-order-lines";

const createSchema = z.object({
  description: z.string().min(1),
  hours: z.number().positive().default(1),
  rateAzn: z.number().nonnegative(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const lines = await prisma.workOrderLaborLine.findMany({
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
    if (wo.status === "COMPLETED") {
      return jsonError("Work order is closed", 400);
    }
    const body = createSchema.parse(await req.json());
    const amountAzn = lineAmount(body.hours, body.rateAzn);
    await prisma.workOrderLaborLine.create({
      data: {
        workOrderId: id,
        description: body.description,
        hours: body.hours,
        rateAzn: body.rateAzn,
        amountAzn,
      },
    });
    const updated = await recalcWorkOrderTotals(id);
    return jsonOk(updated, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
