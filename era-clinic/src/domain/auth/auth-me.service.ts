import { prisma } from "@/lib/prisma";

export async function findSessionUserWithRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export async function findDefaultTenantCheckInSettings() {
  return prisma.tenant.findFirst({
    where: { code: "default" },
    select: { name: true, checkInRequiresQr: true, procedureCheckInMode: true },
  });
}
