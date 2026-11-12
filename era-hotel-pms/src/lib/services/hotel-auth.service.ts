import {
  authenticateIndustryStaffLogin,
  enterSatelliteTenant,
  runWithSatelliteTenant,
  satelliteRuntimeConfig,
} from '@era/satellite-kit';
import { prisma } from '@/lib/prisma';
import { ensureSystemHotelRoles } from '@/lib/auth/ensure-system-hotel-roles';
import { ROLE_CODES } from '@/lib/auth/permissions';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';

export async function authenticateStaffLogin(request: Request) {
  return authenticateIndustryStaffLogin({
    request,
    prisma,
    isShared: satelliteRuntimeConfig().deploymentTopology === 'SHARED',
  });
}

export async function completeStaffLoginAfterAuth(userId: string, organizationId: string) {
  return runWithSatelliteTenant({ organizationId }, async () => {
    await ensureSystemHotelRoles(prisma, organizationId);
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    return prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
  });
}

export async function ensureHotelRolesForOrganization(organizationId: string) {
  await ensureSystemHotelRoles(prisma, organizationId);
}

export async function loadUserWithRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export async function loadHotelProfileSummary() {
  return prisma.hotelProfile.findFirst({
    select: { name: true, organizationId: true },
  });
}

export type SsoFinanceUserInput = {
  organizationId: string;
  email: string;
  fullName: string;
  financeRole: string;
};

export async function provisionSsoFinanceUser(input: SsoFinanceUserInput) {
  const organizationId = input.organizationId;
  enterSatelliteTenant({ organizationId });
  await ensureSystemHotelRoles(prisma, organizationId);

  const email = input.email.trim().toLowerCase();
  const isPlatformSuperAdmin = isPlatformSuperAdminUser({
    email,
    login: email,
  });

  const roleCode = isPlatformSuperAdmin ? ROLE_CODES.HOTEL_ADMIN : ROLE_CODES.FINANCIAL_AUDITOR;
  const role = await prisma.role.findFirst({
    where: { organizationId, code: roleCode },
  });
  if (!role) {
    return { ok: false as const, reason: 'role_missing' as const };
  }

  const login = `sso_${email.split('@')[0]}`;
  let user = await prisma.user.findFirst({
    where: { login, organizationId },
    include: { role: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        organizationId,
        login,
        email,
        fullName: input.fullName,
        passwordHash: 'sso:no-password',
        roleId: role.id,
        isCrossSystem: true,
        status: 'ACTIVE',
      },
      include: { role: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        fullName: input.fullName,
        email,
        roleId: role.id,
      },
      include: { role: true },
    });
  }

  return { ok: true as const, user, isPlatformSuperAdmin, email };
}

export async function findActiveAgencyForPortal(organizationId: string, agencyId: string) {
  return prisma.agency.findFirst({
    where: { id: agencyId, organizationId, active: true },
  });
}
