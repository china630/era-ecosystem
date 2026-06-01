import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listClosedRooms } from '@/lib/services/wave-b-master.service';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ROOMS_STATUS);
    return jsonOk(serialize(await listClosedRooms()));
  } catch (err) {
    return handleRouteError(err);
  }
}
