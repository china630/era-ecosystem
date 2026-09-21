import { assertHotelModuleActive } from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { permissionsForUser } from '@/lib/auth/hotel-permission.service';
import { prisma } from '@/lib/prisma';

export type HotelImportAccess = {
  userId: string;
  via: 'platform_super_admin' | 'grant_and_sku';
};

/** Elektraweb bulk import — grant api:import.elektraweb ∩ hotel_migration_pro (SA bypass). */
export async function assertHotelImportAccess(): Promise<HotelImportAccess> {
  const session = await getSessionFromHeaders();
  if (!session) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      login: true,
      status: true,
      role: { select: { code: true } },
    },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('Unauthorized');
  }

  if (isPlatformSuperAdminUser(user)) {
    return { userId: user.id, via: 'platform_super_admin' };
  }

  const perms = await permissionsForUser(session.sub);

  if (
    !sessionHasHotelPermission(
      {
        login: user.login,
        email: user.email ?? undefined,
        role: user.role.code,
        permissions: perms,
        isOwner: session.isOwner,
      },
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
    )
  ) {
    throw new Error('Forbidden: import requires api:import.elektraweb');
  }

  const organizationId = await resolveImportOrganizationId();
  if (!organizationId) {
    throw new Error('Forbidden: organization not configured');
  }

  await assertHotelModuleActive(organizationId, 'hotel_migration_pro');
  return { userId: user.id, via: 'grant_and_sku' };
}

/** @deprecated Use {@link assertHotelImportAccess} */
export async function assertPlatformSuperAdminImport(): Promise<void> {
  await assertHotelImportAccess();
}

export async function canRunHotelImport(user: {
  email: string | null;
  login: string;
  status: string;
  roleCode: string;
  permissions?: string[];
  isOwner?: boolean;
}): Promise<boolean> {
  if (user.status !== 'ACTIVE') return false;
  if (isPlatformSuperAdminUser({ email: user.email, login: user.login })) return true;
  if (
    !sessionHasHotelPermission(
      {
        login: user.login,
        email: user.email ?? undefined,
        role: user.roleCode,
        permissions: user.permissions,
        isOwner: user.isOwner,
      },
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
    )
  ) {
    return false;
  }
  const organizationId = await resolveImportOrganizationId();
  if (!organizationId) return false;
  try {
    await assertHotelModuleActive(organizationId, 'hotel_migration_pro');
    return true;
  } catch {
    return false;
  }
}

async function resolveImportOrganizationId(): Promise<string | undefined> {
  let organizationId: string | undefined;
  try {
    organizationId = requestOrganizationId();
  } catch {
    organizationId = undefined;
  }
  if (!organizationId || organizationId === 'demo-org') {
    organizationId = (
      await prisma.hotelProfile.findFirst({ select: { organizationId: true } })
    )?.organizationId?.trim();
  }
  return organizationId;
}
