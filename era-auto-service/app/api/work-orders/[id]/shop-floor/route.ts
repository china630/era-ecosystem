import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["start", "stop"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return jsonError("Work order not found", 404);

    if (body.action === "start") {
      const updated = await prisma.workOrder.update({
        where: { id },
        data: { shopFloorStartedAt: new Date(), status: "IN_PROGRESS" },
      });
      return jsonOk(updated);
    }

    const started = wo.shopFloorStartedAt;
    const ended = new Date();
    const minutes = started
      ? Math.round((ended.getTime() - started.getTime()) / 60000)
      : 0;
    const updated = await prisma.workOrder.update({
      where: { id },
      data: { shopFloorEndedAt: ended },
    });
    return jsonOk({ ...updated, shopFloorMinutes: minutes });
  } catch (err) {
    return handleRouteError(err);
  }
}
