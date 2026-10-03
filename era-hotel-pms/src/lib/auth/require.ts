import type { Permission } from './permissions';
import type { SatelliteSessionPayload } from '@era/satellite-kit';
import { sessionHasHotelPermission } from './permission-check';

export function assertPermission<S extends SatelliteSessionPayload>(
  session: S | null,
  permission: Permission,
): asserts session is S {
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

export function assertAnyPermission<S extends SatelliteSessionPayload>(
  session: S | null,
  permissions: Permission[],
): asserts session is S {
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
