import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationsForGrid } from '@/lib/services/reservation-full.service';

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const guestId = new URL(req.url).searchParams.get('guestId') ?? undefined;
    return jsonOk(serialize(await listReservationsForGrid(guestId)));
  } catch (err) {
    return handleRouteError(err);
  }
}
