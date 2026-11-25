import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { requestOrganizationId } from "@/lib/request-organization";

export async function listProjectTasks(projectId: string) {
  return prisma.projectTask.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { startDate: "asc" },
  });
}

export type CreateProjectTaskInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  progressPct?: number;
  dependsOnId?: string | null;
};

export async function createProjectTask(projectId: string, body: CreateProjectTaskInput) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (body.endDate < body.startDate) {
    return { error: "endDate must be on or after startDate" as const, status: 400 as const };
  }
  const progressPct = Math.min(100, Math.max(0, body.progressPct ?? 0));
  const row = await prisma.projectTask.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      progressPct,
      dependsOnId: body.dependsOnId ?? null,
    },
  });
  return { row };
}

export async function softDeleteProjectTask(projectId: string, taskId: string) {
  const row = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
  });
  if (!row) return { error: "Task not found" as const, status: 404 as const };
  const updated = await prisma.projectTask.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
  return { row: updated };
}
