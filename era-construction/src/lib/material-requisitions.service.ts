import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { REQUISITION_STATUS_TRANSITIONS } from "@/lib/requisition-status";

export async function listMaterialRequisitions() {
  return prisma.materialRequisition.findMany({
    where: { deletedAt: null },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type CreateMaterialRequisitionInput = {
  projectId: string;
  itemCode: string;
  description: string;
  qty: number;
};

export async function createMaterialRequisition(body: CreateMaterialRequisitionInput) {
  return prisma.materialRequisition.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId: body.projectId,
      itemCode: body.itemCode,
      description: body.description,
      qty: body.qty,
      status: "DRAFT",
    },
    include: { project: true },
  });
}

export async function transitionMaterialRequisition(requisitionId: string, status: string) {
  const row = await prisma.materialRequisition.findFirst({
    where: { id: requisitionId, deletedAt: null },
  });
  if (!row) return { error: "Requisition not found" as const, status: 404 as const };
  const allowed = REQUISITION_STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot transition requisition ${row.status} → ${status}`,
      status: 409 as const,
    };
  }
  const updated = await prisma.materialRequisition.update({
    where: { id: requisitionId },
    data: { status },
  });
  return { row: updated };
}
