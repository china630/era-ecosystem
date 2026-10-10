import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import { resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { parseBakuDateTime } from "@era/satellite-kit/time";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Book or move the clock on an existing visit. Does not create a second visit. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const visit = await prisma.visit.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        patientRefId: true,
        practitionerId: true,
        appointmentId: true,
        status: true,
      },
    });
    if (!visit) return jsonError("Visit not found", 404);
    if (visit.status === "CANCELLED") return jsonError("Visit is cancelled", 400);

    const scheduledAt = parseBakuDateTime(body.date, body.time);
    if (await electiveDayDenied(scheduledAt)) {
      return jsonError("Clinic is closed on this date", 409, { code: "CLOSED_DAY" });
    }
    if (visit.appointmentId) {
      await prisma.appointment.update({
        where: { id: visit.appointmentId },
        data: { scheduledAt, status: "SCHEDULED" },
      });
      return jsonOk({ visitId: visit.id, scheduledAt: scheduledAt.toISOString() });
    }

    const appointment = await prisma.appointment.create({
      data: {
        organizationId: visit.organizationId,
        patientRefId: visit.patientRefId,
        practitionerId: visit.practitionerId,
        scheduledAt,
        durationMinutes: await resolveAppointmentDurationMinutes({}),
        status: "SCHEDULED",
      },
    });
    await prisma.visit.update({
      where: { id: visit.id },
      data: { appointmentId: appointment.id },
    });
    return jsonOk({ visitId: visit.id, scheduledAt: scheduledAt.toISOString() });
  } catch (err) {
    return handleRouteError(err);
  }
}
