import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  desk: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const ticket = await prisma.queueTicket.findUnique({ where: { id } });
    if (!ticket) return jsonError("Queue ticket not found", 404);
    if (ticket.status !== "WAITING") {
      return jsonError(`Cannot call ticket in status ${ticket.status}`, 400);
    }

    const updated = await prisma.queueTicket.update({
      where: { id },
      data: {
        status: "CALLED",
        calledAt: new Date(),
        desk: body.desk ?? ticket.desk,
      },
      include: {
        visit: { include: { patientRef: true, practitioner: true } },
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
