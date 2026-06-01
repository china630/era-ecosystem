import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const plate = url.searchParams.get("plate")?.trim();
    const vin = url.searchParams.get("vin")?.trim();
    if (!plate && !vin) return jsonError("plate or vin required", 400);

    const orClause = [
      ...(plate ? [{ vehiclePlate: plate }] : []),
      ...(vin ? [{ vin }] : []),
    ];
    const orders = await prisma.workOrder.findMany({
      where: { OR: orClause },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jsonOk({
      plate: plate ?? null,
      vin: vin ?? null,
      timeline: orders.map((o) => ({
        workOrderId: o.id,
        code: o.code,
        status: o.status,
        partsStatus: o.partsStatus,
        laborAmount: Number(o.laborAmount),
        partsAmount: Number(o.partsAmount),
        completedAt: o.completedAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
