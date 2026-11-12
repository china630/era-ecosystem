import { prisma } from "@/lib/prisma";

export async function listProjectTasks(projectId: string) {
  return prisma.projectTask.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
  });
}
