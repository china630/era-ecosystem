import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

/** Single lab order with items + structural results + patient ref, for the workflow detail page. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        patientRef: true,
        visit: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            diagnosticService: { include: { modality: true } },
            results: true,
          },
        },
      },
    });
    if (!order) return jsonError("Lab order not found", 404);
    return jsonOk(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
