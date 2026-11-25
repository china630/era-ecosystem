import { prisma } from "@/lib/prisma";
import type { WaitlistEntryStatus } from "@prisma/client";

export async function listWaitlistEntries(status?: WaitlistEntryStatus) {
  const rows = await prisma.waitlistEntry.findMany({
    where: status ? { status } : { status: { in: ["OPEN", "OFFERED"] } },
    include: {
      patientRef: { select: { id: true, fullName: true, refCode: true, phone: true } },
      practitioner: { select: { id: true, fullName: true, code: true } },
    },
    orderBy: [{ preferredFrom: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientRefId: r.patientRefId,
    patientName: r.patientRef.fullName,
    patientRefCode: r.patientRef.refCode,
    patientPhone: r.patientRef.phone,
    serviceCode: r.serviceCode,
    practitionerId: r.practitionerId,
    practitionerName: r.practitioner?.fullName ?? null,
    preferredFrom: r.preferredFrom?.toISOString().slice(0, 10) ?? null,
    preferredTo: r.preferredTo?.toISOString().slice(0, 10) ?? null,
    status: r.status,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createWaitlistEntry(input: {
  organizationId: string;
  patientRefId: string;
  serviceCode?: string | null;
  practitionerId?: string | null;
  preferredFrom?: string | null;
  preferredTo?: string | null;
  notes?: string | null;
}) {
  const row = await prisma.waitlistEntry.create({
    data: {
      organizationId: input.organizationId,
      patientRefId: input.patientRefId,
      serviceCode: input.serviceCode?.trim() || null,
      practitionerId: input.practitionerId ?? null,
      preferredFrom: input.preferredFrom
        ? new Date(`${input.preferredFrom}T00:00:00.000Z`)
        : null,
      preferredTo: input.preferredTo ? new Date(`${input.preferredTo}T00:00:00.000Z`) : null,
      notes: input.notes ?? null,
    },
  });
  return row;
}

export async function patchWaitlistEntry(
  id: string,
  patch: Partial<{
    status: WaitlistEntryStatus;
    notes: string | null;
    practitionerId: string | null;
  }>,
) {
  return prisma.waitlistEntry.update({ where: { id }, data: patch });
}