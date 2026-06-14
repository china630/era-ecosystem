import { getSessionFromHeaders } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { prisma } from '@/lib/prisma';

/** Elektraweb bulk import is platform super-admin only (migration / bootstrap). */
export async function assertPlatformSuperAdminImport(): Promise<void> {
  const session = await getSessionFromHeaders();
  if (!session) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { email: true, login: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE' || !isPlatformSuperAdminUser(user)) {
    throw new Error('Forbidden: platform super-admin only');
  }
}
