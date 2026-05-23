import { hasPermission, type Permission } from './permissions';
import type { SessionPayload } from './jwt';

export function assertPermission(session: SessionPayload | null, permission: Permission): void {
  if (!session) throw new Error('Unauthorized');
  if (!hasPermission(session.role, permission)) {
    throw new Error('Forbidden: insufficient permissions');
  }
}

export function assertAnyPermission(
  session: SessionPayload | null,
  permissions: Permission[],
): void {
  if (!session) throw new Error('Unauthorized');
  if (!permissions.some((p) => hasPermission(session.role, p))) {
    throw new Error('Forbidden: insufficient permissions');
  }
}
