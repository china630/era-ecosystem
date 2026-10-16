import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateReservationSchedule } from '@/lib/services/reservation.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  roomId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const { loadReservationAuditSnapshot, recordReservationDiff } = await import(
      '@/lib/reservation-audit'
    );
    const before = await loadReservationAuditSnapshot(id);
    const reservation = await updateReservationSchedule(id, body);
    const after = await loadReservationAuditSnapshot(id);
    await recordReservationDiff(id, 'UPDATE', before, after, {
      userId: session?.sub,
      request,
    });
    return jsonOk(serialize(reservation));
  } catch (err) {
    return handleRouteError(err);
  }
}
