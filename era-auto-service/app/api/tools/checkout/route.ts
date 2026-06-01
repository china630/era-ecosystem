import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  toolId: z.string(),
  checkedOutBy: z.string(),
  return: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const tool = await prisma.tool.findUnique({ where: { id: body.toolId } });
    if (!tool) return jsonError("Tool not found", 404);

    if (body.return) {
      const open = await prisma.toolCheckout.findFirst({
        where: { toolId: body.toolId, returnedAt: null },
        orderBy: { checkedOutAt: "desc" },
      });
      if (!open) return jsonError("No open checkout", 404);
      const updated = await prisma.toolCheckout.update({
        where: { id: open.id },
        data: { returnedAt: new Date() },
      });
      return jsonOk(updated);
    }

    const checkout = await prisma.toolCheckout.create({
      data: {
        toolId: body.toolId,
        checkedOutBy: body.checkedOutBy,
      },
    });
    return jsonOk(checkout, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
