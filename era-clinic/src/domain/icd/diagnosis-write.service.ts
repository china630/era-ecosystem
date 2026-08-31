import { prisma } from "@/lib/prisma";
import { IcdCatalogError } from "@/domain/icd/icd-catalog";
import { requireSelectableIcd } from "@/domain/icd/icd-search.service";
import type { AdmissionDiagnosisKind, DiagnosisRole } from "@prisma/client";

export async function addEpisodeDiagnosis(
  episodeId: string,
  input: { icdCodeId: string; note?: string | null; recordedByUserId?: string | null },
) {
  const episode = await prisma.clinicalEpisode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new IcdCatalogError("Episode not found", 404);
  await requireSelectableIcd(input.icdCodeId);
  return prisma.clinicalDiagnosis.create({
    data: {
      episodeId,
      icdCodeId: input.icdCodeId,
      note: input.note?.trim() || null,
      recordedByUserId: input.recordedByUserId ?? null,
    },
    include: { icdCode: true },
  });
}

export async function listEpisodeDiagnoses(episodeId: string) {
  return prisma.clinicalDiagnosis.findMany({
    where: { episodeId },
    include: { icdCode: true },
    orderBy: { recordedAt: "desc" },
  });
}

export async function deleteEpisodeDiagnosis(id: string, patientRefId: string) {
  const row = await prisma.clinicalDiagnosis.findUnique({
    where: { id },
    include: { episode: { select: { patientRefId: true, status: true } } },
  });
  if (!row || row.episode.patientRefId !== patientRefId) {
    throw new IcdCatalogError("Diagnosis not found", 404);
  }
  if (row.episode.status !== "OPEN") {
    throw new IcdCatalogError("Closed episode is read-only", 409);
  }
  await prisma.clinicalDiagnosis.delete({ where: { id } });
}

export async function updateEpisodeDiagnosis(
  id: string,
  patientRefId: string,
  input: { icdCodeId?: string; note?: string | null },
) {
  const row = await prisma.clinicalDiagnosis.findUnique({
    where: { id },
    include: { episode: { select: { patientRefId: true, status: true } } },
  });
  if (!row || row.episode.patientRefId !== patientRefId) {
    throw new IcdCatalogError("Diagnosis not found", 404);
  }
  if (row.episode.status !== "OPEN") {
    throw new IcdCatalogError("Closed episode is read-only", 409);
  }
  if (input.icdCodeId) await requireSelectableIcd(input.icdCodeId);
  return prisma.clinicalDiagnosis.update({
    where: { id },
    data: {
      ...(input.icdCodeId ? { icdCodeId: input.icdCodeId } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    },
    include: { icdCode: true },
  });
}

export async function listVisitDiagnoses(visitId: string) {
  return prisma.visitDiagnosis.findMany({
    where: { visitId },
    include: { icdCode: true },
    orderBy: [{ role: "asc" }, { recordedAt: "asc" }],
  });
}

export async function addVisitDiagnosis(
  visitId: string,
  input: {
    icdCodeId: string;
    role?: DiagnosisRole;
    note?: string | null;
    recordedByUserId?: string | null;
  },
) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new IcdCatalogError("Visit not found", 404);
  await requireSelectableIcd(input.icdCodeId);
  return prisma.visitDiagnosis.create({
    data: {
      visitId,
      organizationId: visit.organizationId,
      icdCodeId: input.icdCodeId,
      role: input.role ?? "PRIMARY",
      note: input.note?.trim() || null,
      recordedByUserId: input.recordedByUserId ?? null,
    },
    include: { icdCode: true },
  });
}

export async function deleteVisitDiagnosis(id: string) {
  await prisma.visitDiagnosis.delete({ where: { id } });
}

export async function listAdmissionDiagnoses(admissionId: string) {
  return prisma.admissionDiagnosis.findMany({
    where: { admissionId },
    include: { icdCode: true },
    orderBy: [{ kind: "asc" }, { role: "asc" }, { recordedAt: "asc" }],
  });
}

export async function addAdmissionDiagnosis(
  admissionId: string,
  input: {
    icdCodeId: string;
    kind?: AdmissionDiagnosisKind;
    role?: DiagnosisRole;
    note?: string | null;
    recordedByUserId?: string | null;
  },
) {
  const admission = await prisma.inpatientAdmission.findUnique({
    where: { id: admissionId },
  });
  if (!admission) throw new IcdCatalogError("Admission not found", 404);
  await requireSelectableIcd(input.icdCodeId);
  return prisma.admissionDiagnosis.create({
    data: {
      admissionId,
      organizationId: admission.organizationId,
      icdCodeId: input.icdCodeId,
      kind: input.kind ?? "ADMISSION",
      role: input.role ?? "PRIMARY",
      note: input.note?.trim() || null,
      recordedByUserId: input.recordedByUserId ?? null,
    },
    include: { icdCode: true },
  });
}

export async function deleteAdmissionDiagnosis(id: string) {
  await prisma.admissionDiagnosis.delete({ where: { id } });
}
