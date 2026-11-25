import { prisma } from "@/lib/prisma";
import type {
  InpatientAdmissionKind,
  InpatientAdmissionOutcome,
  InpatientAdmissionSource,
} from "@prisma/client";
import { assignBedToPatient, admitRegisteredPatientToBed } from "./ward.service";
import { nextInpatientCaseNumber } from "./case-number.service";

export type RegisterAdmissionInput = {
  patientRefId: string;
  admissionKind?: InpatientAdmissionKind;
  source?: InpatientAdmissionSource;
  referralRef?: string | null;
  departmentId?: string | null;
  attendingPractitionerId?: string | null;
};

export type AdmitPatientInput = {
  patientRefId: string;
  bedId: string;
  admissionKind?: InpatientAdmissionKind;
  source?: InpatientAdmissionSource;
  referralRef?: string | null;
  departmentId?: string | null;
  attendingPractitionerId?: string | null;
  admissionId?: string | null;
};

export async function registerAdmission(input: RegisterAdmissionInput) {
  return prisma.inpatientAdmission.create({
    data: {
      patientRefId: input.patientRefId,
      status: "REGISTERED",
      registeredAt: new Date(),
      admissionKind: input.admissionKind ?? "PLANNED",
      source: input.source ?? "SELF",
      referralRef: input.referralRef ?? null,
      departmentId: input.departmentId ?? null,
      attendingPractitionerId: input.attendingPractitionerId ?? null,
    },
  });
}

export async function refuseAdmission(admissionId: string, refusalReason: string) {
  const admission = await prisma.inpatientAdmission.findUnique({ where: { id: admissionId } });
  if (!admission) throw new Error("Admission not found");
  if (admission.status !== "REGISTERED") {
    throw new Error("Only REGISTERED admissions can be refused");
  }
  if (!refusalReason.trim()) throw new Error("refusalReason required");
  return prisma.inpatientAdmission.update({
    where: { id: admissionId },
    data: {
      status: "REFUSED",
      refusalReason: refusalReason.trim(),
      dischargedAt: new Date(),
    },
  });
}

export async function admitPatient(input: AdmitPatientInput) {
  if (input.admissionId) {
    return admitRegisteredPatientToBed({
      admissionId: input.admissionId,
      bedId: input.bedId,
      attendingPractitionerId: input.attendingPractitionerId,
      departmentId: input.departmentId,
    });
  }
  return assignBedToPatient({
    bedId: input.bedId,
    patientRefId: input.patientRefId,
    admissionKind: input.admissionKind,
    source: input.source,
    referralRef: input.referralRef,
    departmentId: input.departmentId,
    attendingPractitionerId: input.attendingPractitionerId,
  });
}

export async function transferAdmission(
  admissionId: string,
  newBedId: string,
  ctx?: { byUserId?: string | null; reason?: string | null },
) {
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

    await tx.inpatientMovement.create({
      data: {
        admissionId: admission.id,
        fromBedId: current.bedId,
        toBedId: newBedId,
        fromDepartmentId: admission.departmentId,
        toDepartmentId: admission.departmentId,
        reason: ctx?.reason ?? null,
        byUserId: ctx?.byUserId ?? null,
      },
    });

    return assignment;
  });
}

export async function dischargeAdmission(
  admissionId: string,
  outcome?: InpatientAdmissionOutcome | null,
) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: admissionId },
    include: {
      assignments: { where: { dischargedAt: null }, take: 1 },
    },
  });
  if (!admission) throw new Error("Admission not found");
  if (admission.status !== "ADMITTED") throw new Error("Admission not active");

  const active = admission.assignments[0];

  return prisma.$transaction(async (tx) => {
    if (active) {
      await tx.bedAssignment.update({
        where: { id: active.id },
        data: { dischargedAt: new Date() },
      });
      await tx.bed.update({
        where: { id: active.bedId },
        data: { status: "CLEANING" },
      });
    }
    return tx.inpatientAdmission.update({
      where: { id: admissionId },
      data: {
        status: "DISCHARGED",
        dischargedAt: new Date(),
        outcome: outcome ?? admission.outcome,
      },
    });
  });
}

export async function listRegisteredAdmissions() {
  return prisma.inpatientAdmission.findMany({
    where: { status: "REGISTERED" },
    orderBy: { registeredAt: "asc" },
    include: {
      patient: { select: { id: true, refCode: true, fullName: true } },
    },
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
      caseNumber: admission.caseNumber,
      admissionKind: admission.admissionKind,
      source: admission.source,
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

export async function ensureCaseNumberForAdmission(admissionId: string, organizationId: string) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: admissionId },
    select: { caseNumber: true },
  });
  if (admission?.caseNumber) return admission.caseNumber;
  const caseNumber = await nextInpatientCaseNumber(organizationId);
  await prisma.inpatientAdmission.update({
    where: { id: admissionId },
    data: { caseNumber },
  });
  return caseNumber;
}