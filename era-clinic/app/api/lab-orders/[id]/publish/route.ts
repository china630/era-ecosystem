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
    if (order.status !== "RESULT_READY") {
      return jsonError(`Cannot publish from status ${order.status}`, 400);
    }
    if (!order.resultJson) {
      return jsonError("Results required before publish", 400);
    }

    const published = await prisma.labOrder.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: { patientRef: true, visit: true },
    });
    return jsonOk(published);
  } catch (err) {
    return handleRouteError(err);
  }
}
