import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";

export async function listBoqLines(projectId: string) {
  return prisma.boqLine.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { itemCode: "asc" },
  });
}

export type UpsertBoqLineInput = {
  itemCode: string;
  description: string;
  plannedQty: number;
  plannedAmountNet?: number;
};

export async function upsertBoqLine(projectId: string, body: UpsertBoqLineInput) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const line = await prisma.boqLine.upsert({
    where: {
      projectId_itemCode: {
        projectId,
        itemCode: body.itemCode,
      },
    },
    update: {
      description: body.description,
      plannedQty: body.plannedQty,
      plannedAmountNet: body.plannedAmountNet ?? 0,
      deletedAt: null,
    },
    create: {
      projectId,
      itemCode: body.itemCode,
      description: body.description,
      plannedQty: body.plannedQty,
      plannedAmountNet: body.plannedAmountNet ?? 0,
    },
  });

  return { line };
}
