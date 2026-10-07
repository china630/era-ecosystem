import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { checkInReservation } from '@/lib/services/reservation.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z.object({ early: z.boolean().optional() }).optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const body = bodySchema.parse(raw ?? {});
    const reservation = await checkInReservation(id, { early: body?.early === true });
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
