import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  sendNotification,
  createBookingAppointment,
} from "@/integration/control-plane-platform.client";

const CRON_SECRET = process.env.PLATFORM_CRON_SECRET ?? "";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600_000);
    const windowStart = new Date(in24h.getTime() - 30 * 60_000);
    const windowEnd = new Date(in24h.getTime() + 30 * 60_000);

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        reminderSentAt: null,
      },
      include: { patientRef: true, practitioner: true },
    });

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
    let sent = 0;
    for (const appt of appointments) {
      const phone = appt.patientRef.phone?.trim();
      if (!phone || !organizationId) continue;

      await sendNotification(
        {
          templateKey: "clinic.appointment.reminder",
          channel: "WHATSAPP",
          messageClass: "TRANSACTIONAL",
          recipient: phone,
          sourceEntityType: "appointment",
          sourceEntityId: appt.id,
          body: `Напоминание: приём ${appt.scheduledAt.toISOString()} — ${appt.practitioner.fullName}`,
          payload: {
            scheduledAt: appt.scheduledAt.toISOString(),
            practitionerName: appt.practitioner.fullName,
          },
        },
        { organizationId },
      );

      await createBookingAppointment(
        {
          customerRef: appt.patientRef.refCode,
          customerPhone: phone,
          customerName: appt.patientRef.fullName,
          scheduledAt: appt.scheduledAt.toISOString(),
          resourceKey: appt.practitioner.code,
          metadata: { appointmentId: appt.id },
        },
        { organizationId },
      ).catch(() => undefined);

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }

    return jsonOk({ scanned: appointments.length, sent });
  } catch (err) {
    return handleRouteError(err);
  }
}
