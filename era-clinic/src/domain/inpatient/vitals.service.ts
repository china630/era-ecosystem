import { prisma } from "@/lib/prisma";
import type { RiskAssessmentScale, VitalSignKind } from "@prisma/client";

export async function listVitalsForAdmission(admissionId: string) {
  return prisma.vitalSign.findMany({
    where: { admissionId },
    orderBy: { measuredAt: "asc" },
  });
}

export async function recordVital(input: {
  patientRefId: string;
  admissionId?: string | null;
  visitId?: string | null;
  clinicalEpisodeId?: string | null;
  kind: VitalSignKind;
  value: number;
  unit: string;
  measuredAt?: Date;
  byUserId?: string | null;
}) {
  return prisma.vitalSign.create({
    data: {
      patientRefId: input.patientRefId,
      admissionId: input.admissionId ?? null,
      visitId: input.visitId ?? null,
      clinicalEpisodeId: input.clinicalEpisodeId ?? null,
      kind: input.kind,
      value: input.value,
      unit: input.unit,
      measuredAt: input.measuredAt ?? new Date(),
      byUserId: input.byUserId ?? null,
    },
  });
}

export async function listRiskAssessmentsForAdmission(admissionId: string) {
  return prisma.riskAssessment.findMany({
    where: { admissionId },
    orderBy: { assessedAt: "desc" },
  });
}

export async function recordRiskAssessment(input: {
  admissionId: string;
  scale: RiskAssessmentScale;
  score: number;
  answers: Record<string, unknown>;
  byUserId?: string | null;
}) {
  return prisma.riskAssessment.create({
    data: {
      admissionId: input.admissionId,
      scale: input.scale,
      score: input.score,
      answersJson: JSON.stringify(input.answers ?? {}),
      byUserId: input.byUserId ?? null,
    },
  });
}