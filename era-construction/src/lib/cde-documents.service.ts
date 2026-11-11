import { prisma } from "@/lib/prisma";

export async function listDrawingRevisions(projectId: string | null) {
  return prisma.drawingRevision.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type CreateDrawingRevisionInput = {
  projectId: string;
  drawingCode: string;
  revision: string;
  fileName?: string;
};

export async function createDrawingRevision(body: CreateDrawingRevisionInput) {
  return prisma.drawingRevision.create({ data: body });
}
