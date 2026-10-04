import { assertHotelModuleActive } from '@era/satellite-kit';
import { getSatelliteSession } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { PERMISSIONS } from '@/lib/auth/permissions';

export type HotelImportAccess = {
  userId: string;
  via: 'platform_super_admin' | 'grant_and_sku';
};

/**
 * Elektraweb bulk import - grant api:import.elektraweb + hotel_migration_pro (SA bypass).
 * The single session read for import routes.
 */
export async function assertHotelImportAccess(): Promise<HotelImportAccess> {
  const session = await getSatelliteSession();
  if (!session) throw new Error('Unauthorized');

  if (isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    return { userId: session.sub, via: 'platform_super_admin' };
  }

  if (
    !sessionHasHotelPermission(
      {
        login: session.login,
        email: session.email ?? undefined,
        role: session.role,
        permissions: session.permissions,
        isOwner: session.isOwner,
      },
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
    )
  ) {
    throw new Error('Forbidden: import requires api:import.elektraweb');
  }

  await assertHotelModuleActive(session.organizationId, 'hotel_migration_pro');
  return { userId: session.sub, via: 'grant_and_sku' };
}

export async function canRunHotelImport(user: {
  organizationId: string;
  email: string | null;
  login: string;
  roleCode: string;
  permissions?: string[];
  isOwner?: boolean;
}): Promise<boolean> {
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
  try {
    await assertHotelModuleActive(user.organizationId, 'hotel_migration_pro');
    return true;
  } catch {
    return false;
  }
}
