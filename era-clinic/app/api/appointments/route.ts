import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";
import { trySendPlatformNotification } from "@/lib/platform-notify";

const createSchema = z.object({
  patientRefCode: z.string(),
  patientFullName: z.string(),
  patientPhone: z.string().optional(),
  patientFin: z.string().optional(),
  practitionerCode: z.string(),
  practitionerFullName: z.string(),
  scheduledAt: z.string().datetime().optional(),
  serviceLines: z
    .array(
      z.object({
        serviceCode: z.string(),
        description: z.string(),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
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

    let patient = await prisma.patientRef.findUnique({
      where: { refCode: body.patientRefCode },
    });
    if (!patient) {
      patient = await prisma.patientRef.create({
        data: {
          refCode: body.patientRefCode,
          fullName: body.patientFullName,
          phone: body.patientPhone,
        },
      });
    }
    if (!patient.globalPersonId) {
      await linkPatientGlobalPerson({
        patientRefId: patient.id,
        fin: body.patientFin,
        fullName: body.patientFullName,
        phone: body.patientPhone,
      });
      patient = await prisma.patientRef.findUniqueOrThrow({
        where: { id: patient.id },
      });
    }

    let practitioner = await prisma.practitioner.findUnique({
      where: { code: body.practitionerCode },
    });
    if (!practitioner) {
      practitioner = await prisma.practitioner.create({
        data: { code: body.practitionerCode, fullName: body.practitionerFullName },
      });
    }

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : new Date();
    const serviceLines = body.serviceLines ?? [];
    const amountNet = serviceLines.reduce((s, l) => s + l.amount, 0);

    const appointment = await prisma.appointment.create({
      data: {
        patientRefId: patient.id,
        practitionerId: practitioner.id,
        scheduledAt,
        visit: {
          create: {
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
      await trySendPlatformNotification({
        templateKey: "clinic.appointment.confirmed",
        channel: "SMS",
        messageClass: "TRANSACTIONAL",
        recipient: phone,
        sourceEntityType: "appointment",
        sourceEntityId: appointment.id,
        body: `Appointment confirmed ${scheduledAt.toISOString().slice(0, 16)} with ${practitioner.fullName}`,
        payload: { appointmentId: appointment.id, scheduledAt: scheduledAt.toISOString() },
      });
    }

    return jsonOk(appointment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
