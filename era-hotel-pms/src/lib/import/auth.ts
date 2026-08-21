import { assertHotelModuleActive, satelliteOrganizationId } from '@era/satellite-kit';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { prisma } from '@/lib/prisma';

const OWNER_IMPORT_ROLES = new Set([
  'Hotel_Admin',
  'DIRECTOR',
  'OWNER',
  'MANAGER',
]);

export type HotelImportAccess = {
  userId: string;
  via: 'platform_super_admin' | 'owner_entitlement';
};

/** Elektraweb bulk import — platform super-admin or entitled hotel owner/admin. */
export async function assertHotelImportAccess(): Promise<HotelImportAccess> {
  const session = await getSessionFromHeaders();
  if (!session) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, login: true, status: true, role: { select: { code: true } } },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('Unauthorized');
  }

  if (isPlatformSuperAdminUser(user)) {
    return { userId: user.id, via: 'platform_super_admin' };
  }

  const roleCode = user.role.code;
  if (!OWNER_IMPORT_ROLES.has(roleCode)) {
    throw new Error('Forbidden: import requires platform super-admin or hotel admin');
  }

  let organizationId: string | undefined;
  try {
    organizationId = satelliteOrganizationId();
  } catch {
    organizationId = undefined;
  }
  if (!organizationId || organizationId === "demo-org") {
    organizationId = (
      await prisma.hotelProfile.findFirst({ select: { organizationId: true } })
    )?.organizationId?.trim();
  }
  if (!organizationId) {
    throw new Error("Forbidden: organization not configured");
  }

  await assertHotelModuleActive(organizationId, 'hotel_migration_pro');
  return { userId: user.id, via: 'owner_entitlement' };
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
}): Promise<boolean> {
  if (user.status !== 'ACTIVE') return false;
  if (isPlatformSuperAdminUser({ email: user.email, login: user.login })) return true;
  if (!OWNER_IMPORT_ROLES.has(user.roleCode)) return false;
  let organizationId: string | undefined;
  try {
    organizationId = satelliteOrganizationId();
  } catch {
    return true;
  }
  if (!organizationId || organizationId === "demo-org") return true;
  try {
    await assertHotelModuleActive(organizationId, "hotel_migration_pro");
    return true;
  } catch {
    return false;
  }
}
