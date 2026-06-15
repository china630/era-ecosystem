import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

export async function listWards() {
  return prisma.ward.findMany({
    orderBy: { code: "asc" },
    include: {
      beds: { orderBy: { code: "asc" } },
    },
  });
}

export async function createWard(data: {
  code: string;
  name: string;
  dailyChargeCode?: string | null;
}) {
  return prisma.ward.create({ data });
}

export async function updateWard(
  id: string,
  data: { name?: string; dailyChargeCode?: string | null },
) {
  return prisma.ward.update({ where: { id }, data });
}

export async function deleteWard(id: string) {
  const occupied = await prisma.bed.count({
    where: { wardId: id, status: "OCCUPIED" },
  });
  if (occupied > 0) throw new Error("Ward has occupied beds");
  await prisma.ward.delete({ where: { id } });
}

export async function createBed(data: {
  wardId: string;
  code: string;
  status?: string;
}) {
  return prisma.bed.create({
    data: {
      wardId: data.wardId,
      code: data.code,
      status: data.status ?? "AVAILABLE",
    },
  });
}

export async function updateBed(
  id: string,
  data: { status?: string; code?: string },
) {
  return prisma.bed.update({ where: { id }, data });
}

export async function deleteBed(id: string) {
  const active = await prisma.bedAssignment.findFirst({
    where: { bedId: id, dischargedAt: null },
  });
  if (active) throw new Error("Bed has active assignment");
  await prisma.bed.delete({ where: { id } });
}

export async function assignBedToPatient(input: {
  bedId: string;
  patientRefId: string;
}) {
  const bed = await prisma.bed.findUnique({ where: { id: input.bedId } });
  if (!bed) throw new Error("Bed not found");
  if (bed.status === "OCCUPIED") throw new Error("Bed is already occupied");

  const activeOnBed = await prisma.bedAssignment.findFirst({
    where: { bedId: bed.id, dischargedAt: null },
  });
  if (activeOnBed) throw new Error("Bed is already occupied");

  return prisma.$transaction(async (tx) => {
    const admission = await tx.inpatientAdmission.create({
      data: {
        patientRefId: input.patientRefId,
        status: "ADMITTED",
      },
    });
    const assignment = await tx.bedAssignment.create({
      data: {
        bedId: bed.id,
        patientRefId: input.patientRefId,
        admissionId: admission.id,
      },
    });
    await tx.bed.update({
      where: { id: bed.id },
      data: { status: "OCCUPIED" },
    });
    return { admission, assignment };
  });
}

export async function auditWardChange(
  ctx: { userId?: string | null; request?: Request },
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
) {
  await recordClinicAudit(ctx, entityType, entityId, action, changes);
}
