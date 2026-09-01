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
    const params = new URL(req.url).searchParams;
    const hasNotesRaw = params.get('hasNotes');
    const result = await listReservationsForGrid({
      guestId: params.get('guestId') ?? undefined,
      q: params.get('q') ?? undefined,
      status: params.get('status') ?? undefined,
      hasNotes: hasNotesRaw === '1' || hasNotesRaw === 'true',
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      dateFrom: params.get('dateFrom') ?? undefined,
      dateTo: params.get('dateTo') ?? undefined,
    });
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
