import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true, visit: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (order.status !== "ORDERED") {
      return jsonError(`Cannot collect from status ${order.status}`, 400);
    }

    const collected = await prisma.labOrder.update({
      where: { id },
      data: { status: "COLLECTED", collectedAt: new Date() },
      include: { patientRef: true, visit: true },
    });
    return jsonOk(collected);
  } catch (err) {
    return handleRouteError(err);
  }
}
