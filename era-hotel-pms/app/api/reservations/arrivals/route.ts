import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listArrivals } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const dateParam = new URL(request.url).searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : new Date();
    const arrivals = await listArrivals(date);
    return jsonOk(serialize(arrivals));
  } catch (err) {
    return handleRouteError(err);
  }
}
