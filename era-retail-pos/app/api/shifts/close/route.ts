import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  shiftId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
      include: { register: { include: { outlet: true } } },
    });
    if (!shift) return jsonError("Shift not found", 404);
    if (shift.status === "CLOSED") return jsonOk(shift);

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    return jsonOk(closed);
  } catch (err) {
    return handleRouteError(err);
  }
}
