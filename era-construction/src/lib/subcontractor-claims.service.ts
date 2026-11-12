import { prisma } from "@/lib/prisma";

export async function listSubcontractorClaims(projectId: string) {
  return prisma.subcontractorClaim.findMany({
    where: { projectId },
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
  return prisma.subcontractorClaim.create({
    data: {
      projectId,
      subcontractorName: body.subcontractorName,
      amountNet: body.amountNet,
      notes: body.notes,
      status: "SUBMITTED",
    },
  });
}
