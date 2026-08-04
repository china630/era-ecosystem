import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateHotelLookup } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateHotelLookup(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
