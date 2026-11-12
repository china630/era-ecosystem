import { prisma } from "@/lib/prisma";

export async function findPatientRefsByGlobalPersonId(globalPersonId: string) {
  return prisma.patientRef.findMany({
    where: { globalPersonId },
    select: { id: true, organizationId: true },
  });
}

export async function listPublishedPortalLabResults(patientRefIds: string[]) {
  return prisma.labOrder.findMany({
    where: {
      patientRefId: { in: patientRefIds },
      status: "COMPLETED",
      publishedAt: { not: null },
    },
    select: {
      id: true,
      testCode: true,
      status: true,
      completedAt: true,
      publishedAt: true,
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });
}
