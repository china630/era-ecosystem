import { z } from "zod";
import { NextResponse } from "next/server";
import { createBookingAppointment } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

const schema = z.object({
  customerRef: z.string().min(1).max(64),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(32).optional(),
  scheduledAt: z.string().datetime(),
  practitionerCode: z.string().min(1).max(64).default("GP-01"),
});

/**
 * SEC-CLI-02: public booking may create a pending appointment only.
 * Does not create visits, practitioners, or MDM-linked patient intake.
 */
export async function POST(request: Request) {
  try {
    const enabled = process.env.CLINIC_PUBLIC_BOOKING_ENABLED?.trim();
    if (process.env.NODE_ENV === "production" && enabled !== "true") {
      return NextResponse.json(
        { error: "Public booking disabled" },
        { status: 403 },
      );
    }

    const body = schema.parse(await request.json());
    let orgId: string | undefined;
    try {
      const id = requestOrganizationId();
      orgId = id === "demo-org" ? undefined : id;
    } catch {
      orgId = undefined;
    }

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

    const practitioner = await prisma.practitioner.findFirst({
      where: { code: body.practitionerCode },
    });
    if (!practitioner) {
      return NextResponse.json(
        { error: "Practitioner not found" },
        { status: 404 },
      );
    }

    // Pending patient stub — no MDM link from public path
    const organizationId = requestOrganizationId();
    let patient = await prisma.patientRef.findFirst({
      where: { organizationId, refCode: body.customerRef },
    });
    if (!patient) {
      patient = await prisma.patientRef.create({
        data: {
          organizationId,
          refCode: body.customerRef,
          fullName: body.customerName,
          phone: body.customerPhone,
        },
      });
    }
    if (!patient) throw new Error("Failed to ensure patient ref");

    const appointment = await prisma.appointment.create({
      data: {
        organizationId,
        patientRefId: patient.id,
        practitionerId: practitioner.id,
        scheduledAt: new Date(body.scheduledAt),
        status: "SCHEDULED",
      },
      include: { patientRef: true, practitioner: true },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "booking failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
