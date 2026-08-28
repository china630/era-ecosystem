import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { detectSchedulingConflict } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { requestOrganizationId } from "@/lib/request-organization";

const createSchema = z
  .object({
    patientRefId: z.string().min(1).optional(),
    patientRefCode: z.string().min(1).optional(),
    practitionerCode: z.string().min(1),
    scheduledAt: z.string().datetime().optional(),
    roomCode: z.string().optional(),
    resourceId: z.string().optional(),
    serviceLines: z
      .array(
        z.object({
          serviceCode: z.string(),
          description: z.string(),
          amount: z.number().nonnegative(),
        }),
      )
      .optional(),
  })
  .refine((b) => Boolean(b.patientRefId || b.patientRefCode), {
    message: "patientRefId or patientRefCode required",
  });

export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { patientRef: true, practitioner: true, visit: true },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });
    return jsonOk(appointments);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());

    const organizationId = requestOrganizationId();
    const patient = body.patientRefId
      ? await prisma.patientRef.findUnique({ where: { id: body.patientRefId } })
      : await prisma.patientRef.findFirst({
          where: { organizationId, refCode: body.patientRefCode! },
        });
    if (!patient) {
      return jsonError("Patient not found — register the patient first", 400);
    }

    const practitioner = await prisma.practitioner.findFirst({
      where: { code: body.practitionerCode },
    });
    const { practitionerBookableDenied } = await import("@/lib/master-data-gates");
    const mdBlock = practitionerBookableDenied({
      found: Boolean(practitioner),
      active: practitioner?.active,
    });
    if (mdBlock || !practitioner) return jsonError(mdBlock ?? "Practitioner not found", 400);

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : new Date();
    const serviceLines = body.serviceLines ?? [];
    const amountNet = serviceLines.reduce((s, l) => s + l.amount, 0);

    const conflict = await detectSchedulingConflict({
      practitionerCode: body.practitionerCode,
      scheduledAt,
      resourceId: body.resourceId ?? null,
    });
    if (conflict) return jsonError(conflict, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(
      practitioner.id,
      scheduledAt,
      practitioner.defaultSlotMinutes || 30,
    );
    if (!onShift) return jsonError("Practitioner is not on shift at this time", 409);

    const appointment = await prisma.appointment.create({
      data: {
        organizationId,
        patientRefId: patient.id,
        practitionerId: practitioner.id,
        scheduledAt,
        roomCode: body.roomCode?.trim() || null,
        resourceId: body.resourceId || null,
        visit: {
          create: {
            organizationId,
            patientRefId: patient.id,
            practitionerId: practitioner.id,
            amountNet,
            serviceLines: {
              create: serviceLines.map((line) => ({
                serviceCode: line.serviceCode,
                description: line.description,
                amount: line.amount,
              })),
            },
          },
        },
      },
      include: {
        patientRef: true,
        practitioner: true,
        visit: { include: { serviceLines: true } },
      },
    });

    const phone = patient.phone?.trim();
    if (phone) {
      await trySendPlatformNotification(
        {
          templateKey: "clinic.appointment.confirmed",
          channel: "SMS",
          messageClass: "TRANSACTIONAL",
          recipient: phone,
          sourceEntityType: "appointment",
          sourceEntityId: appointment.id,
          body: `Appointment confirmed ${scheduledAt.toISOString().slice(0, 16)} with ${practitioner.fullName}`,
          payload: { appointmentId: appointment.id, scheduledAt: scheduledAt.toISOString() },
        },
        { organizationId },
      );
    }

    return jsonOk(appointment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
