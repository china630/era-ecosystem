import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { relocateReservationRoom } from '@/lib/services/reservation-relocate.service';

const schema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  compUpgrade: z.boolean().optional(),
  givenRoomTypeId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const reservation = await relocateReservationRoom(id, body.roomId, {
      reason: body.reason,
      reasonCode: body.reasonCode,
      compUpgrade: body.compUpgrade,
      givenRoomTypeId: body.givenRoomTypeId,
      actorUserId: session?.sub,
    });
    return jsonOk(serialize(reservation));
  } catch (err) {
    return handleRouteError(err);
  }
}
