import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listUserLogins } from '@/lib/services/user.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const url = new URL(request.url);
    const rows = await listUserLogins({
      q: url.searchParams.get('q') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
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
