import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";

export async function getVisitById(id: string) {
  return prisma.visit.findUnique({
    where: { id },
    include: {
      patientRef: true,
      practitioner: true,
      serviceLines: true,
    },
  });
}

export async function getVisitForCompletion(id: string) {
  return prisma.visit.findUnique({
    where: { id },
    include: { patientRef: true, serviceLines: true },
  });
}

export async function completeVisitRecord(id: string) {
  return prisma.visit.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: { patientRef: true, serviceLines: true, appointment: true },
  });
}

export async function completeLinkedAppointment(appointmentId: string) {
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });
}

export async function getVisitForAppointmentBooking(id: string) {
  return prisma.visit.findUnique({
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
}

export async function updateAppointmentSchedule(appointmentId: string, scheduledAt: Date) {
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { scheduledAt, status: "SCHEDULED" },
  });
}

export async function attachNewAppointmentToVisit(
  visit: {
    id: string;
    organizationId: string;
    patientRefId: string;
    practitionerId: string | null;
  },
  scheduledAt: Date,
) {
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
  return appointment;
}

export async function visitExists(id: string) {
  const visit = await prisma.visit.findUnique({ where: { id }, select: { id: true } });
  return visit !== null;
}

export async function getVisitForWrite(id: string) {
  return prisma.visit.findUnique({ where: { id } });
}

export async function listVisitCpoeEntries(visitId: string) {
  return prisma.cpoeEntry.findMany({
    where: { visitId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createVisitCpoeEntry(data: {
  visitId: string;
  templateId?: string;
  payloadJson: string;
}) {
  return prisma.cpoeEntry.create({
    data: {
      visitId: data.visitId,
      templateId: data.templateId,
      payloadJson: data.payloadJson,
    },
  });
}

export async function getVisitPayGateSnapshot(id: string) {
  return prisma.visit.findUnique({
    where: { id },
    select: { amountNet: true, settledAt: true },
  });
}

export async function getVisitWithPatientRef(id: string) {
  return prisma.visit.findUnique({
    where: { id },
    include: { patientRef: true },
  });
}

export async function applyVisitDiscountTransaction(input: {
  visitId: string;
  discountedAmount: number;
  percent: number;
  approvedBy: string;
  reason: string;
}) {
  return prisma.$transaction([
    prisma.visit.update({
      where: { id: input.visitId },
      data: { amountNet: input.discountedAmount },
    }),
    prisma.visitDiscountAudit.create({
      data: {
        visitId: input.visitId,
        percent: input.percent,
        approvedBy: input.approvedBy,
        reason: input.reason,
      },
    }),
  ]);
}

export async function cancelVisit(visitId: string, reason: string, userId?: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { appointment: true },
  });
  if (!visit) throw new Error("Visit not found");
  if (visit.status === "COMPLETED") {
    throw new Error("Cannot cancel completed visit");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.visit.update({
      where: { id: visitId },
      data: { status: "CANCELLED" },
    });
    if (visit.appointmentId) {
      await tx.appointment.update({
        where: { id: visit.appointmentId },
        data: { status: "CANCELLED" },
      });
    }
    return updated;
  }).then(async (updated) => {
    if (visit.clinicalEpisodeId) {
      const lines = await prisma.visitServiceLine.findMany({
        where: { visitId, inPackage: true },
        select: { packageQuotaCode: true, serviceCode: true },
      });
      if (lines.length > 0) {
        const { resolveEntitlementInstance, syncEntitlementUsage } = await import(
          "@/domain/sanatorium/entitlement-usage.service"
        );
        const instance = await resolveEntitlementInstance(visit.clinicalEpisodeId);
        if (instance) {
          const codes = new Set(
            lines.map((l) => l.packageQuotaCode?.trim() || l.serviceCode),
          );
          for (const quotaCode of codes) {
            if (!quotaCode) continue;
            await syncEntitlementUsage({
              instanceId: instance.id,
              episodeId: visit.clinicalEpisodeId,
              quotaCode,
            });
          }
        }
      }
    }
    await recordClinicAudit(
      { userId: userId ?? null },
      "Visit",
      visitId,
      "CANCEL",
      { reason },
    );
    return updated;
  });
}

export async function cancelAppointment(appointmentId: string, reason: string, userId?: string) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new Error("Appointment not found");
  if (appt.status === "COMPLETED") throw new Error("Cannot cancel completed appointment");

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });
  await recordClinicAudit(
    { userId: userId ?? null },
    "Appointment",
    appointmentId,
    "CANCEL",
    { reason },
  );
  return updated;
}
