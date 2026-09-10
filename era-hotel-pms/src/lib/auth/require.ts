import type { Permission } from './permissions';
import type { SessionPayload } from './jwt';
import { sessionHasHotelPermission } from './permission-check';

export function assertPermission(session: SessionPayload | null, permission: Permission): void {
  if (!session) throw new Error('Unauthorized');
  if (
    !sessionHasHotelPermission(
      {
        login: session.login,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        isOwner: session.isOwner,
      },
      permission,
    )
  ) {
    throw new Error('Forbidden: insufficient permissions');
  }
}

export function assertAnyPermission(
  session: SessionPayload | null,
  permissions: Permission[],
): void {
  if (!session) throw new Error('Unauthorized');
  if (
    !permissions.some((p) =>
      sessionHasHotelPermission(
        {
          login: session.login,
          email: session.email,
          role: session.role,
          permissions: session.permissions,
          isOwner: session.isOwner,
        },
        p,
      ),
    )
  ) {
    throw new Error('Forbidden: insufficient permissions');
  }
}
