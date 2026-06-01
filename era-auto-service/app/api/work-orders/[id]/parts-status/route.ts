import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  partsStatus: z.enum(["NONE", "ORDERED", "RECEIVED", "INSTALLED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return jsonError("Work order not found", 404);
    const updated = await prisma.workOrder.update({
      where: { id },
      data: { partsStatus: body.partsStatus },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
