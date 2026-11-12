import { prisma } from "@/lib/prisma";

export type CreateEquipmentLogInput = {
  projectId: string;
  equipmentCode: string;
  hours: number;
  logDate: Date;
};

export async function createEquipmentLog(body: CreateEquipmentLogInput) {
  return prisma.equipmentLog.create({
    data: {
      projectId: body.projectId,
      equipmentCode: body.equipmentCode,
      hours: body.hours,
      logDate: body.logDate,
    },
  });
}
