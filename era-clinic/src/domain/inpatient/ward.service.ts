import type {
  BedStatus,
  InpatientAdmissionKind,
  InpatientAdmissionSource,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { requestOrganizationId } from "@/lib/request-organization";
import { nextInpatientCaseNumber } from "./case-number.service";

const BED_STATUSES: BedStatus[] = ["AVAILABLE", "OCCUPIED", "CLEANING", "BLOCKED"];

function asBedStatus(status: string | undefined): BedStatus | undefined {
  if (!status) return undefined;
  return BED_STATUSES.find((value) => value === status);
}

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

export async function listBedsByWard(wardId: string) {
  return prisma.bed.findMany({
    where: { wardId },
    orderBy: { code: "asc" },
  });
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
      status: asBedStatus(data.status) ?? "AVAILABLE",
    },
  });
}

export async function updateBed(
  id: string,
  data: { status?: string; code?: string },
) {
  const patch: Prisma.BedUpdateInput = {};
  if (data.code !== undefined) patch.code = data.code;
  if (data.status !== undefined) patch.status = asBedStatus(data.status) ?? "AVAILABLE";
  return prisma.bed.update({ where: { id }, data: patch });
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
  admissionKind?: InpatientAdmissionKind;
  source?: InpatientAdmissionSource;
  referralRef?: string | null;
  departmentId?: string | null;
  attendingPractitionerId?: string | null;
}) {
  const bed = await prisma.bed.findUnique({ where: { id: input.bedId } });
  if (!bed) throw new Error("Bed not found");
  if (bed.status !== "AVAILABLE") throw new Error("Bed not available");

  const activeOnBed = await prisma.bedAssignment.findFirst({
    where: { bedId: bed.id, dischargedAt: null },
  });
  if (activeOnBed) throw new Error("Bed is already occupied");

  const organizationId = await requestOrganizationId();

  return prisma.$transaction(async (tx) => {
    const caseNumber = await nextInpatientCaseNumber(organizationId);
    const admission = await tx.inpatientAdmission.create({
      data: {
        patientRefId: input.patientRefId,
        status: "ADMITTED",
        admittedAt: new Date(),
        caseNumber,
        admissionKind: input.admissionKind ?? "PLANNED",
        source: input.source ?? "SELF",
        referralRef: input.referralRef ?? null,
        departmentId: input.departmentId ?? null,
        attendingPractitionerId: input.attendingPractitionerId ?? null,
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
    await tx.inpatientMovement.create({
      data: {
        admissionId: admission.id,
        toBedId: bed.id,
        toDepartmentId: input.departmentId ?? null,
        reason: "Initial admission",
      },
    });
    return { admission, assignment };
  });
}

export async function admitRegisteredPatientToBed(input: {
  admissionId: string;
  bedId: string;
  departmentId?: string | null;
  attendingPractitionerId?: string | null;
}) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: input.admissionId },
  });
  if (!admission || admission.status !== "REGISTERED") {
    throw new Error("Admission not in REGISTERED status");
  }

  const bed = await prisma.bed.findUnique({ where: { id: input.bedId } });
  if (!bed || bed.status !== "AVAILABLE") throw new Error("Bed not available");

  const organizationId = await requestOrganizationId();
  const caseNumber = admission.caseNumber ?? (await nextInpatientCaseNumber(organizationId));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.inpatientAdmission.update({
      where: { id: admission.id },
      data: {
        status: "ADMITTED",
        admittedAt: new Date(),
        caseNumber,
        departmentId: input.departmentId ?? admission.departmentId,
        attendingPractitionerId:
          input.attendingPractitionerId ?? admission.attendingPractitionerId,
      },
    });
    const assignment = await tx.bedAssignment.create({
      data: {
        bedId: bed.id,
        patientRefId: admission.patientRefId,
        admissionId: admission.id,
      },
    });
    await tx.bed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });
    await tx.inpatientMovement.create({
      data: {
        admissionId: admission.id,
        toBedId: bed.id,
        toDepartmentId: updated.departmentId,
        reason: "Admission from reception",
      },
    });
    return { admission: updated, assignment };
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
