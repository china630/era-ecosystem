import { prisma } from "@/lib/prisma";

export async function listFnbLimitHolders(organizationId: string) {
  return prisma.fnbLimitHolder.findMany({
    where: { organizationId },
    orderBy: { displayName: "asc" },
  });
}

export async function createFnbLimitHolder(
  organizationId: string,
  data: { displayName: string; ceilingAzn: number; outletId: string | null },
) {
  return prisma.fnbLimitHolder.create({
    data: {
      organizationId,
      displayName: data.displayName,
      ceilingAzn: data.ceilingAzn,
      outletId: data.outletId,
    },
  });
}

export async function findFnbLimitHolderByOrg(organizationId: string, id: string) {
  return prisma.fnbLimitHolder.findFirst({ where: { id, organizationId } });
}

export async function updateFnbLimitHolderUsedAzn(id: string, usedAzn: number) {
  return prisma.fnbLimitHolder.update({
    where: { id },
    data: { usedAzn },
  });
}

export async function findActiveFnbLimitHolder(organizationId: string, id: string) {
  return prisma.fnbLimitHolder.findFirst({
    where: { id, organizationId, active: true },
  });
}
