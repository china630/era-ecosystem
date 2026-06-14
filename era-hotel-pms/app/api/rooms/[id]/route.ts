import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateRoomMasterData } from '@/lib/services/room.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  floor: z.number().int().optional(),
  description: z.string().optional().nullable(),
  viewCode: z.string().optional().nullable(),
  bedTypeCode: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  maxBed: z.number().int().optional().nullable(),
  disabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
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
    if (Object.keys(body).length === 0) {
      throw new Error('No fields to update');
    }
    const room = await updateRoomMasterData(id, body);
    return jsonOk(serialize(room));
  } catch (err) {
    return handleRouteError(err);
  }
}
