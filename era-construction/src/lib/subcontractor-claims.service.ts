import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { CLAIM_STATUS_TRANSITIONS } from "@/lib/claim-status";

export async function listSubcontractorClaims(projectId: string) {
  return prisma.subcontractorClaim.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateSubcontractorClaimInput = {
  subcontractorName: string;
  amountNet: number;
  notes?: string | null;
};

export async function createSubcontractorClaim(
  projectId: string,
  body: CreateSubcontractorClaimInput,
) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (!(body.amountNet > 0)) {
    return { error: "Claim amount must be positive" as const, status: 400 as const };
  }
  const row = await prisma.subcontractorClaim.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      subcontractorName: body.subcontractorName,
      amountNet: body.amountNet,
      notes: body.notes,
      status: "SUBMITTED",
    },
  });
  return { row };
}

export async function transitionSubcontractorClaim(
  projectId: string,
  claimId: string,
  status: string,
) {
  const row = await prisma.subcontractorClaim.findFirst({
    where: { id: claimId, projectId, deletedAt: null },
  });
  if (!row) return { error: "Claim not found" as const, status: 404 as const };
  const allowed = CLAIM_STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot transition claim ${row.status} → ${status}`,
      status: 409 as const,
    };
  }
  const updated = await prisma.subcontractorClaim.update({
    where: { id: claimId },
    data: { status },
  });
  return { row: updated };
}

export async function softDeleteSubcontractorClaim(projectId: string, claimId: string) {
  const row = await prisma.subcontractorClaim.findFirst({
    where: { id: claimId, projectId, deletedAt: null },
  });
  if (!row) return { error: "Claim not found" as const, status: 404 as const };
  const updated = await prisma.subcontractorClaim.update({
    where: { id: claimId },
    data: { deletedAt: new Date() },
  });
  return { row: updated };
}
