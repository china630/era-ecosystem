import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { checkInReservation } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id } = await params;
    const reservation = await checkInReservation(id);
    let guestQrToken: string | null = null;
    if (reservation.ratePlan?.medicalFlag && reservation.guest?.globalPersonId) {
      try {
        const { issueGuestQrToken } = await import('@era/satellite-kit');
        const qr = await issueGuestQrToken(reservation.guest.globalPersonId);
        guestQrToken = qr?.token ?? null;
      } catch {
        guestQrToken = null;
      }
    }
    return jsonOk({ ...serialize(reservation), guestQrToken });
  } catch (err) {
    return handleRouteError(err);
  }
}
