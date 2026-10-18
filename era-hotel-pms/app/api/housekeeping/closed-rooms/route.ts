import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listClosedRooms } from '@/lib/services/wave-b-master.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.ROOMS_STATUS, PERMISSIONS.HOUSEKEEPING_MANAGE]);
    return jsonOk(serialize(await listClosedRooms()));
  } catch (err) {
    return handleRouteError(err);
  }
}
