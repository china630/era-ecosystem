import { headers } from 'next/headers';
import type { SessionPayload } from './jwt';

export async function getSessionFromHeaders(): Promise<SessionPayload | null> {
  const h = await headers();
  const userId = h.get('x-user-id');
  const role = h.get('x-user-role');
  const login = h.get('x-user-login');
  const fullName = h.get('x-user-fullname');
  if (!userId || !role) return null;
  return {
    sub: userId,
    role,
    login: login ?? '',
    fullName: fullName ?? '',
  };
}
