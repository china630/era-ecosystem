import { prisma } from "@/lib/prisma";

export async function listMaterialRequisitions() {
  return prisma.materialRequisition.findMany({
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
      projectId: body.projectId,
      itemCode: body.itemCode,
      description: body.description,
      qty: body.qty,
    },
    include: { project: true },
  });
}
