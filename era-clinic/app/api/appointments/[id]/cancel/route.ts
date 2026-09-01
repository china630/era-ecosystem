import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { appointmentCancelDenied } from "@/lib/appointment-status-gates";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
    if (denied) return denied;

    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { visit: true },
    });
    if (!appt) return jsonError("Appointment not found", 404);
    if (appt.status === "CANCELLED") return jsonOk(appt);

    const cancelBlock = appointmentCancelDenied(appt.status);
    if (cancelBlock) return jsonError(cancelBlock, 409);

    if (appt.visit && appt.visit.status !== "CANCELLED" && appt.visit.status !== "COMPLETED") {
      await prisma.visit.update({
        where: { id: appt.visit.id },
        data: { status: "CANCELLED" },
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { patientRef: true, practitioner: true, visit: true },
    });

    void body.reason;
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
