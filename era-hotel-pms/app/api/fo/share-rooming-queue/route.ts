import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listShareRoomingQueue } from '@/lib/services/share-assignment.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

/** FIFO unassigned share-eligible stays for union rooming. */
export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const roomTypeId = url.searchParams.get('roomTypeId') ?? undefined;
    const gender = url.searchParams.get('gender') as 'M' | 'F' | null;
    const limit = url.searchParams.get('limit');
    const rows = await listShareRoomingQueue({
      roomTypeId,
      gender: gender === 'M' || gender === 'F' ? gender : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}
