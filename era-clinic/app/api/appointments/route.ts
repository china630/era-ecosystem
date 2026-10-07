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
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  detectSchedulingConflict,
  resolveAppointmentDurationMinutes,
} from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDateTimeDisplay } from "@/lib/baku-day";

const createSchema = z
  .object({
    patientRefId: z.string().min(1).optional(),
    patientRefCode: z.string().min(1).optional(),
    practitionerCode: z.string().min(1),
    scheduledAt: z.string().datetime().optional(),
    roomCode: z.string().optional(),
    resourceId: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(240).optional(),
    serviceCode: z.string().trim().min(1).optional(),
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

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const deniedRead = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
    );
    if (deniedRead) {
      const deniedWrite = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
      );
      if (deniedWrite) return deniedWrite;
    }

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
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    if (denied) return denied;

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
    const serviceCode = body.serviceCode ?? body.serviceLines?.[0]?.serviceCode;
    const durationMinutes = await resolveAppointmentDurationMinutes({
      durationMinutes: body.durationMinutes,
      serviceCode,
    });
    let serviceLines = body.serviceLines ?? [];
    if (serviceLines.length === 0 && serviceCode) {
      const catalog = await prisma.serviceCatalogCache.findFirst({
        where: { organizationId, code: serviceCode },
        select: { description: true, amount: true, listAmount: true },
      });
      const list = catalog?.listAmount != null ? Number(catalog.listAmount) : 0;
      const amount = list > 0 ? list : Number(catalog?.amount ?? 0);
      serviceLines = [
        {
          serviceCode,
          description: catalog?.description?.trim() || serviceCode,
          amount: amount > 0 ? amount : 0,
        },
      ];
    }
    const amountNet = serviceLines.reduce((s, l) => s + l.amount, 0);

    const conflict = await detectSchedulingConflict({
      practitionerCode: body.practitionerCode,
      scheduledAt,
      durationMinutes,
      resourceId: body.resourceId ?? null,
    });
    if (conflict) return jsonError(conflict, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(
      practitioner.id,
      scheduledAt,
      durationMinutes,
    );
    if (!onShift) return jsonError("Practitioner is not on shift at this time", 409);

    const appointment = await prisma.appointment.create({
      data: {
        organizationId,
        patientRefId: patient.id,
        practitionerId: practitioner.id,
        scheduledAt,
        durationMinutes,
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
          body: `Appointment confirmed ${bakuDateTimeDisplay(scheduledAt)} with ${practitioner.fullName}`,
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
