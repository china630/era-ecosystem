import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listInHouseGuests } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const query = url.searchParams.get('query') ?? undefined;
    const roomNumber = url.searchParams.get('roomNumber') ?? undefined;
    const limit = url.searchParams.get('limit');
    const guests = await listInHouseGuests({
      query,
      roomNumber,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return jsonOk(serialize(guests));
  } catch (err) {
    return handleRouteError(err);
  }
}
