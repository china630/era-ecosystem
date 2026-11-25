import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { requestOrganizationId } from "@/lib/request-organization";

export type CreateEquipmentLogInput = {
  projectId: string;
  equipmentCode: string;
  hours: number;
  logDate: Date;
};

export async function listEquipmentLogs(projectId: string) {
  return prisma.equipmentLog.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { logDate: "desc" },
    take: 100,
  });
}

export async function createEquipmentLog(body: CreateEquipmentLogInput) {
  const project = await findProjectById(body.projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (!(body.hours >= 0)) {
    return { error: "hours must be >= 0" as const, status: 400 as const };
  }
  const row = await prisma.equipmentLog.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId: body.projectId,
      equipmentCode: body.equipmentCode,
      hours: body.hours,
      logDate: body.logDate,
    },
  });
  return { row };
}
