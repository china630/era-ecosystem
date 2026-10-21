import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { stayCheckIn, stayCheckOut } from '@/lib/hotel-calendar';
import { listDraftGuestOverlaps } from '@/lib/services/reservation.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const guestId = url.searchParams.get('guestId')?.trim() ?? '';
    const checkIn = url.searchParams.get('checkIn')?.trim() ?? '';
    const checkOut = url.searchParams.get('checkOut')?.trim() ?? '';
    if (!guestId || !checkIn || !checkOut) {
      return jsonOk([]);
    }
    return jsonOk(
      serialize(await listDraftGuestOverlaps([guestId], stayCheckIn(checkIn), stayCheckOut(checkOut))),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
