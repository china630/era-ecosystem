import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { addRoomStayFromReservation } from '@/lib/services/booking-stays.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Ctx = { params: Promise<{ id: string }> };

/** POST — ensure Booking group, then clone a sibling RoomStay. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await context.params;
    z.string().uuid().parse(id);
    const stay = await addRoomStayFromReservation(id);
    return jsonOk(serialize(stay), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
