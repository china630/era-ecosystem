import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  scheduledAt: z.string().datetime(),
  roomCode: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) return jsonError("Appointment not found", 404);
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: new Date(body.scheduledAt),
        roomCode: body.roomCode?.trim() || appt.roomCode,
      },
      include: { patientRef: true, practitioner: true },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
