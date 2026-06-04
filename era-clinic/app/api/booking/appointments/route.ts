import { z } from "zod";
import { NextResponse } from "next/server";
import { createBookingAppointment } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";

const schema = z.object({
  customerRef: z.string(),
  customerName: z.string(),
  customerPhone: z.string().optional(),
  scheduledAt: z.string().datetime(),
  practitionerCode: z.string().default("GP-01"),
  practitionerFullName: z.string().default("General Practitioner"),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const orgId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();

    if (orgId) {
      await createBookingAppointment(
        {
          resourceKey: `clinic:${body.practitionerCode}`,
          customerRef: body.customerRef,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          scheduledAt: body.scheduledAt,
          metadata: { source: "clinic_web_booking" },
        },
        { organizationId: orgId },
      ).catch(() => null);
    }

    let patient = await prisma.patientRef.findUnique({
      where: { refCode: body.customerRef },
    });
    if (!patient) {
      patient = await prisma.patientRef.create({
        data: {
          refCode: body.customerRef,
          fullName: body.customerName,
          phone: body.customerPhone,
        },
      });
    }
    await linkPatientGlobalPerson({
      patientRefId: patient.id,
      fullName: body.customerName,
      phone: body.customerPhone,
    });

    let practitioner = await prisma.practitioner.findUnique({
      where: { code: body.practitionerCode },
    });
    if (!practitioner) {
      practitioner = await prisma.practitioner.create({
        data: { code: body.practitionerCode, fullName: body.practitionerFullName },
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientRefId: patient.id,
        practitionerId: practitioner.id,
        scheduledAt: new Date(body.scheduledAt),
        status: "SCHEDULED",
        visit: {
          create: {
            patientRefId: patient.id,
            practitionerId: practitioner.id,
            patientOrigin: "WALK_IN",
            billingTarget: "FINANCE",
          },
        },
      },
      include: { patientRef: true, practitioner: true, visit: true },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "booking failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
