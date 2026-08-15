import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  bodyPart: z
    .enum([
      "HEAD",
      "NECK",
      "CHEST",
      "BACK",
      "ABDOMEN",
      "ARM_LEFT",
      "ARM_RIGHT",
      "LEG_LEFT",
      "LEG_RIGHT",
      "FULL_BODY",
    ])
    .nullable()
    .optional(),
});

/** Patch PROPOSED (or SCHEDULED) order fields such as bodyPart before confirm. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const order = await prisma.procedureOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Procedure order not found", 404);
    if (!["PROPOSED", "SCHEDULED"].includes(order.status)) {
      return jsonError(`Cannot patch bodyPart in status ${order.status}`, 400);
    }
    const updated = await prisma.procedureOrder.update({
      where: { id },
      data: {
        ...(body.bodyPart !== undefined ? { bodyPart: body.bodyPart } : {}),
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
