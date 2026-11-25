import { authenticateIndustryStaffLogin, satelliteRuntimeConfig } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

export async function authenticateElektrawebBridgeStaff(input: {
  headers: { get(name: string): string | null };
  body: unknown;
}) {
  return authenticateIndustryStaffLogin({
    headers: input.headers,
    body: input.body,
    prisma,
    isShared: satelliteRuntimeConfig().deploymentTopology === 'SHARED',
  });
}

export async function loadActiveUserWithRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}
