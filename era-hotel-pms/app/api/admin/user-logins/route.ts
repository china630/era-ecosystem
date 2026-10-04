import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listUserLogins } from '@/lib/services/user.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const rows = await listUserLogins();
    return jsonOk(
      serialize(
        rows.map((row) => ({
          id: row.id,
          login: row.login,
          fullName: row.user.fullName,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          createdAt: row.createdAt,
        })),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
