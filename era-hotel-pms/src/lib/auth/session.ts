import { headers } from 'next/headers';
import type { SessionPayload } from './jwt';
import { prisma } from '@/lib/prisma';

export async function getSessionFromHeaders(): Promise<SessionPayload | null> {
  const h = await headers();
  const userId = h.get('x-user-id');
  const role = h.get('x-user-role');
  const login = h.get('x-user-login');
  const fullName = h.get('x-user-fullname');
  let email = h.get('x-user-email')?.trim() || undefined;
  if (!userId || !role) return null;

  // Legacy tokens (pre-email claim) and sso_* logins: resolve email so
  // platform super-admin gates work without forcing an immediate re-login.
  if (!email) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    email = row?.email?.trim() || undefined;
  }

  return {
    sub: userId,
    role,
    login: login ?? '',
    fullName: fullName ?? '',
    email,
  };
}
