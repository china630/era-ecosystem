import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { parsePermissions } from '@/lib/auth/permissions';
import { ROLE_CODES } from '@/lib/auth/permissions';
import { checkSeatQuota } from '@/lib/licensing/client';

export async function listUsers() {
  return prisma.user.findMany({
    include: { role: true },
    orderBy: { fullName: 'asc' },
  });
}

export async function createUser(input: {
  login: string;
  fullName: string;
  password: string;
  roleId: string;
  email?: string;
  department?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { login: input.login } });
  if (existing) throw new Error('Login already exists');

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new Error('Role not found');

  if (role.code !== ROLE_CODES.FINANCIAL_AUDITOR) {
    const profile = await prisma.hotelProfile.findFirst();
    const quota = await checkSeatQuota({
      organizationId: profile?.organizationId ?? 'nafta-sanatorium-org',
      satelliteType: 'hotel_pms',
    });
    if (!quota.allowed) {
      const err = new Error(quota.message ?? 'Seat quota exceeded');
      (err as Error & { code?: string }).code = 'QUOTA_EXCEEDED';
      throw err;
    }
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      login: input.login,
      fullName: input.fullName,
      passwordHash,
      roleId: input.roleId,
      email: input.email,
      department: input.department,
      status: 'ACTIVE',
    },
    include: { role: true },
  });
}

export async function getUserByLogin(login: string) {
  return prisma.user.findUnique({
    where: { login },
    include: { role: true },
  });
}

export function userPermissions(user: { role: { permissionsJson: string } }) {
  return parsePermissions(user.role.permissionsJson);
}
