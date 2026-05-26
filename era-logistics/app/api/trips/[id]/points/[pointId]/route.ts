import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  status: z.enum(["PENDING", "ARRIVED", "DELIVERED"]),
  podRecipient: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> },
) {
  try {
    const { id, pointId } = await params;
    const body = bodySchema.parse(await req.json());
    const point = await prisma.tripPoint.findFirst({
      where: { id: pointId, tripId: id },
    });
    if (!point) return jsonError("Point not found", 404);
    const updated = await prisma.tripPoint.update({
      where: { id: pointId },
      data: {
        status: body.status,
        podRecipient: body.podRecipient,
        podCapturedAt: body.status === "DELIVERED" ? new Date() : point.podCapturedAt,
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
