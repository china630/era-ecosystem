import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getReservationFull, patchReservationFull } from '@/lib/services/reservation-full.service';
import { reservationFullPatchSchema } from '@/lib/reservation-full-patch.schema';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getReservationFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = reservationFullPatchSchema.parse(await request.json());
    return jsonOk(serialize(await patchReservationFull(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
