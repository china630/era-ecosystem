import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getSellablePreview } from '@/lib/services/room-type-availability.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const roomTypeId = url.searchParams.get('roomTypeId');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!roomTypeId || !fromStr || !toStr) {
      throw new Error('roomTypeId, from, and to query params required');
    }
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid from/to date');
    }
    const data = await getSellablePreview(roomTypeId, from, to);
    return jsonOk(
      serialize({
        roomTypeId,
        from: fromStr.slice(0, 10),
        to: toStr.slice(0, 10),
        ...data,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
