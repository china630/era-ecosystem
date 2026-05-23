import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { assignRoomType } from '@/lib/services/room.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  roomTypeId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const room = await assignRoomType(id, body.roomTypeId);
    return jsonOk(serialize(room));
  } catch (err) {
    return handleRouteError(err);
  }
}
