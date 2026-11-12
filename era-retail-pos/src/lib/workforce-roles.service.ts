import { prisma } from "@/lib/prisma";

export async function listRoleCodesForOrganization(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}
