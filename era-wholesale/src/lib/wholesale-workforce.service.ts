import { prisma } from "@/lib/prisma";

export function listWorkforceRoleCodes(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}
