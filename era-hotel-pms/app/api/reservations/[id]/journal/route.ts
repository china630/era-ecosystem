import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationJournal } from '@/lib/reservation-audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    const url = new URL(request.url);
    const includeIp = Boolean(
      session && sessionHasHotelPermission(session, PERMISSIONS.SCREEN_SETTINGS),
    );
    const journal = await listReservationJournal(id, {
      includeIp,
      section: url.searchParams.get('section') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
    });
    return jsonOk(journal);
  } catch (err) {
    return handleRouteError(err);
  }
}