import { prisma } from '@/lib/prisma';

export async function listWorkforceRolesForBridge(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  });
}
