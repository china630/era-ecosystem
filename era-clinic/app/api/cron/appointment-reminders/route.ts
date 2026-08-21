import { runCronForEachTenant } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  sendNotification,
  createBookingAppointment,
} from "@/integration/control-plane-platform.client";

export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_notifications",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
      },
      async (organizationId) => {
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

        let sent = 0;
        for (const appt of appointments) {
          const phone = appt.patientRef.phone?.trim();
          if (!phone) continue;

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

        return { scanned: appointments.length, sent };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return Response.json({ error: "satellite_unbound" }, { status: 503 });
      }
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return jsonOk(gate.results[0]);
  } catch (err) {
    return handleRouteError(err);
  }
}
