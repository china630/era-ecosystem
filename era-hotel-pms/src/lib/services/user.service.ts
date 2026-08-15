import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import {
  ALL_PERMISSIONS,
  parsePermissions,
  ROLE_CODES,
  type Permission,
} from '@/lib/auth/permissions';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
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

export async function updateUser(
  id: string,
  input: {
    fullName?: string;
    password?: string;
    roleId?: string;
    email?: string | null;
    department?: string | null;
    status?: 'ACTIVE' | 'DISABLED';
  },
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!existing) throw new Error('User not found');
  if (existing.passwordHash === 'sso:no-password' && input.password) {
    throw new Error('Cannot set local password for SSO user');
  }

  if (input.roleId && input.roleId !== existing.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new Error('Role not found');
  }

  const data: {
    fullName?: string;
    passwordHash?: string;
    roleId?: string;
    email?: string | null;
    department?: string | null;
    status?: 'ACTIVE' | 'DISABLED';
  } = {};
  if (input.fullName != null) data.fullName = input.fullName;
  if (input.roleId != null) data.roleId = input.roleId;
  if (input.email !== undefined) data.email = input.email;
  if (input.department !== undefined) data.department = input.department;
  if (input.status != null) data.status = input.status;
  if (input.password && input.password.length >= 6) {
    data.passwordHash = await hashPassword(input.password);
  }

  return prisma.user.update({
    where: { id },
    data,
    include: { role: true },
  });
}

export async function getUserByLogin(credential: string) {
  const id = credential.trim();
  if (!id) return null;
  return prisma.user.findFirst({
    where: {
      OR: [{ login: id }, { email: id }, { phone: id }],
    },
    include: { role: true },
  });
}

export function userPermissions(user: {
  email?: string | null;
  login: string;
  role: { permissionsJson: string };
}): Permission[] {
  if (isPlatformSuperAdminUser(user)) {
    return [...ALL_PERMISSIONS];
  }
  return parsePermissions(user.role.permissionsJson);
}
