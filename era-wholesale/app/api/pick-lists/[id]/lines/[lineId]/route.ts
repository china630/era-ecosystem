import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  qtyPicked: z.number().int().nonnegative(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const { id, lineId } = await params;
    const body = patchSchema.parse(await req.json());

    const line = await prisma.pickListLine.findFirst({
      where: { id: lineId, pickListId: id },
      include: { pickList: { include: { lines: true } } },
    });
    if (!line) return jsonError("Pick line not found", 404);
    if (body.qtyPicked > line.qtyOrdered) {
      return jsonError("qtyPicked exceeds ordered qty", 400);
    }

    await prisma.pickListLine.update({
      where: { id: lineId },
      data: { qtyPicked: body.qtyPicked },
    });

    const pickList = await prisma.pickList.findUnique({
      where: { id },
      include: { order: true, lines: true },
    });

    const allPicked =
      pickList?.lines.every((l) => l.qtyPicked >= l.qtyOrdered) ?? false;
    if (allPicked && pickList?.status === "OPEN") {
      await prisma.pickList.update({
        where: { id },
        data: { status: "PICKED" },
      });
    }

    const updated = await prisma.pickList.findUnique({
      where: { id },
      include: { order: true, lines: true },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
