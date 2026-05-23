import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { cancelReservation } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({ noShow: z.boolean().optional() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CANCEL);
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const reservation = await cancelReservation(id, body.noShow);
    return jsonOk(serialize(reservation));
  } catch (err) {
    return handleRouteError(err);
  }
}
