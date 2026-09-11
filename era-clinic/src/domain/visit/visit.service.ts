import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

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
