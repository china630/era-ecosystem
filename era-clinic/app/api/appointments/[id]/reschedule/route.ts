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
import { detectSchedulingConflict } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";

const bodySchema = z.object({
  scheduledAt: z.string().datetime(),
  roomCode: z.string().optional(),
  resourceId: z.string().nullable().optional(),
  /** Move to another practitioner (matrix row drop). */
  practitionerId: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    if (denied) return denied;

    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { practitioner: true },
    });
    if (!appt) return jsonError("Appointment not found", 404);

    const scheduledAt = new Date(body.scheduledAt);
    if (await electiveDayDenied(scheduledAt)) {
      return jsonError("Clinic is closed on this date", 409, { code: "CLOSED_DAY" });
    }
    const resourceId =
      body.resourceId !== undefined ? body.resourceId : appt.resourceId;

    let practitionerCode = appt.practitioner.code;
    let practitionerId = appt.practitionerId;
    const durationMinutes = appt.durationMinutes || 30;
    if (body.practitionerId && body.practitionerId !== appt.practitionerId) {
      const next = await prisma.practitioner.findUnique({
        where: { id: body.practitionerId },
      });
      if (!next || !next.active) return jsonError("Practitioner not found", 404);
      practitionerCode = next.code;
      practitionerId = next.id;
    }

    const conflict = await detectSchedulingConflict({
      practitionerCode,
      scheduledAt,
      durationMinutes,
      excludeAppointmentId: id,
      resourceId,
    });
    if (conflict) return jsonError(conflict, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(practitionerId, scheduledAt, durationMinutes);
    if (!onShift) return jsonError("Practitioner is not on shift at this time", 409);

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt,
        practitionerId,
        roomCode: body.roomCode?.trim() || appt.roomCode,
        resourceId,
      },
      include: { patientRef: true, practitioner: true, visit: true },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
