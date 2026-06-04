import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { visit: true },
    });
    if (!appointment) return jsonError("Appointment not found", 404);
    if (appointment.status !== "SCHEDULED") {
      return jsonError(`Cannot check-in from status ${appointment.status}`, 400);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CHECKED_IN" },
      include: { patientRef: true, practitioner: true, visit: true },
    });

    if (updated.visit) {
      await prisma.visit.update({
        where: { id: updated.visit.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
