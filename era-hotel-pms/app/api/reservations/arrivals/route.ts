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
    const params = new URL(request.url).searchParams;
    const dateFrom = params.get('dateFrom') ?? params.get('date');
    const dateTo = params.get('dateTo') ?? dateFrom;
    const arrivals = await listArrivals(dateFrom ?? new Date(), dateTo ?? dateFrom ?? new Date());
    return jsonOk(serialize(arrivals));
  } catch (err) {
    return handleRouteError(err);
  }
}
