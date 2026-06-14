import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateRoomType } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { recordHotelAudit } from '@/lib/satellite-audit';

const schema = z.object({
  name: z.string().min(1).optional(),
  baseQuota: z.number().int().positive().optional(),
  adultCapacity: z.number().int().optional(),
  childCapacity: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertMasterDataWrite(session);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const updated = await updateRoomType(id, body);
    if (body.active === false) {
      await recordHotelAudit(
        { userId: session?.sub, request },
        'RoomType',
        id,
        'RETIRE',
        { patch: body },
      );
    }
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
