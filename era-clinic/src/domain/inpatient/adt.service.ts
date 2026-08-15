import { prisma } from "@/lib/prisma";
import { assignBedToPatient } from "./ward.service";

export async function admitPatient(patientRefId: string, bedId: string) {
  return assignBedToPatient({ bedId, patientRefId });
}

export async function transferAdmission(admissionId: string, newBedId: string) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: admissionId },
    include: {
      assignments: { where: { dischargedAt: null }, take: 1 },
    },
  });
  if (!admission || admission.status !== "ADMITTED") {
    throw new Error("Admission not active");
  }

  const current = admission.assignments[0];
  if (!current) throw new Error("No active bed assignment");

  const newBed = await prisma.bed.findUnique({ where: { id: newBedId } });
  if (!newBed || newBed.status !== "AVAILABLE") {
    throw new Error("Target bed not available");
  }

  return prisma.$transaction(async (tx) => {
    await tx.bedAssignment.update({
      where: { id: current.id },
      data: { dischargedAt: new Date() },
    });
    await tx.bed.update({
      where: { id: current.bedId },
      data: { status: "AVAILABLE" },
    });

    const assignment = await tx.bedAssignment.create({
      data: {
        bedId: newBedId,
        patientRefId: admission.patientRefId,
        admissionId: admission.id,
      },
    });
    await tx.bed.update({
      where: { id: newBedId },
      data: { status: "OCCUPIED" },
    });
    await tx.inpatientAdmission.update({
      where: { id: admissionId },
      data: { status: "TRANSFERRED" },
    });
    await tx.inpatientAdmission.update({
      where: { id: admissionId },
      data: { status: "ADMITTED" },
    });

    return assignment;
  });
}

export async function dischargeAdmission(admissionId: string) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: admissionId },
    include: {
      assignments: { where: { dischargedAt: null }, take: 1 },
    },
  });
  if (!admission) throw new Error("Admission not found");

  const active = admission.assignments[0];

  return prisma.$transaction(async (tx) => {
    if (active) {
      await tx.bedAssignment.update({
        where: { id: active.id },
        data: { dischargedAt: new Date() },
      });
      await tx.bed.update({
        where: { id: active.bedId },
        data: { status: "AVAILABLE" },
      });
    }
    return tx.inpatientAdmission.update({
      where: { id: admissionId },
      data: { status: "DISCHARGED", dischargedAt: new Date() },
    });
  });
}

export async function listInpatientCensus() {
  const admissions = await prisma.inpatientAdmission.findMany({
    where: { status: "ADMITTED" },
    orderBy: { admittedAt: "desc" },
    include: {
      patient: { select: { id: true, refCode: true, fullName: true } },
      assignments: {
        where: { dischargedAt: null },
        take: 1,
        include: {
          patient: { select: { id: true, refCode: true, fullName: true } },
          bed: { include: { ward: true } },
        },
      },
    },
  });

  return admissions.map((admission) => {
    const assignment = admission.assignments[0];
    return {
      admissionId: admission.id,
      patientRefId: admission.patientRefId,
      patientName:
        assignment?.patient?.fullName ?? admission.patient?.fullName ?? admission.patientRefId,
      patientRefCode:
        assignment?.patient?.refCode ?? admission.patient?.refCode ?? "",
      wardCode: assignment?.bed?.ward?.code ?? "—",
      wardName: assignment?.bed?.ward?.name ?? "—",
      bedCode: assignment?.bed?.code ?? "—",
      admittedAt: admission.admittedAt.toISOString(),
    };
  });
}

export async function listWardsWithPatients() {
  const wards = await prisma.ward.findMany({
    orderBy: { code: "asc" },
    include: {
      beds: {
        orderBy: { code: "asc" },
        include: {
          assignments: {
            where: { dischargedAt: null },
            take: 1,
            include: {
              admission: true,
              patient: {
                select: { id: true, refCode: true, fullName: true },
              },
            },
          },
        },
      },
    },
  });

  return wards.map((ward) => ({
    ...ward,
    beds: ward.beds.map((bed) => ({
      ...bed,
      assignments: bed.assignments.map((a) => ({
        id: a.id,
        patientRefId: a.patientRefId,
        admittedAt: a.admittedAt,
        admissionId: a.admissionId,
        patient: a.patient,
        admission: a.admission,
      })),
    })),
  }));
}
