import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { assignRoom } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({ roomId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const reservation = await assignRoom(id, body.roomId);
    return jsonOk(serialize(reservation));
  } catch (err) {
    return handleRouteError(err);
  }
}
