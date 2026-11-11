import { authenticateIndustryStaffLogin, satelliteRuntimeConfig } from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';

export async function authenticateElektrawebBridgeStaff(request: Request) {
  return authenticateIndustryStaffLogin({
    request,
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
