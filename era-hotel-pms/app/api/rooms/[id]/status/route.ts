import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateRoomStatus } from '@/lib/services/room.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  status: z.enum([
    'AVAILABLE',
    'OCCUPIED',
    'DIRTY',
    'CLEAN',
    'INSPECTED',
    'OOO',
    'OOS',
    'MAINTENANCE',
  ]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ROOMS_STATUS);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const room = await updateRoomStatus(id, body.status);
    return jsonOk(serialize(room));
  } catch (err) {
    return handleRouteError(err);
  }
}
