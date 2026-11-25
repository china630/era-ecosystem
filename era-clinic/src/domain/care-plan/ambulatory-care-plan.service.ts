import { prisma } from "@/lib/prisma";
import type { AmbulatoryCarePlanStatus } from "@prisma/client";
import type { AmbulatoryCarePlanStage } from "./ambulatory-care-plan.types";

export function shapeCarePlan<
  T extends {
    id: string;
    visitId: string;
    patientRefId: string;
    title: string | null;
    stagesJson: unknown;
    status: AmbulatoryCarePlanStatus;
    proposedAt: Date | null;
    acceptedAt: Date | null;
  },
>(row: T) {
  return {
    id: row.id,
    visitId: row.visitId,
    patientRefId: row.patientRefId,
    title: row.title,
    stages: (Array.isArray(row.stagesJson) ? row.stagesJson : []) as AmbulatoryCarePlanStage[],
    status: row.status,
    proposedAt: row.proposedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
  };
}

export async function getCarePlanForVisit(visitId: string) {
  const row = await prisma.ambulatoryCarePlan.findUnique({ where: { visitId } });
  return row ? shapeCarePlan(row) : null;
}

export async function upsertCarePlanForVisit(input: {
  visitId: string;
  patientRefId: string;
  organizationId: string;
  title?: string | null;
  stages: AmbulatoryCarePlanStage[];
  status?: AmbulatoryCarePlanStatus;
  createdByUserId?: string | null;
}) {
  const status = input.status ?? "DRAFT";
  const timestamps =
    status === "PROPOSED"
      ? { proposedAt: new Date(), acceptedAt: undefined as Date | undefined }
      : status === "ACCEPTED"
        ? { acceptedAt: new Date(), proposedAt: undefined as Date | undefined }
        : {};

  const row = await prisma.ambulatoryCarePlan.upsert({
    where: { visitId: input.visitId },
    create: {
      organizationId: input.organizationId,
      visitId: input.visitId,
      patientRefId: input.patientRefId,
      title: input.title ?? null,
      stagesJson: input.stages,
      status,
      createdByUserId: input.createdByUserId ?? null,
      ...timestamps,
    },
    update: {
      title: input.title ?? null,
      stagesJson: input.stages,
      status,
      ...(status === "PROPOSED" ? { proposedAt: new Date() } : {}),
      ...(status === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
    },
  });
  return shapeCarePlan(row);
}