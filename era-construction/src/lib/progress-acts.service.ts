import { prisma } from "@/lib/prisma";

export async function findProgressActWithProject(id: string) {
  return prisma.progressAct.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function approveProgressAct(id: string) {
  return prisma.progressAct.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
    include: { project: true },
  });
}
