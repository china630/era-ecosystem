import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateReservationSchedule } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
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
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const reservation = await updateReservationSchedule(id, body);
    return jsonOk(serialize(reservation));
  } catch (err) {
    return handleRouteError(err);
  }
}
