import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateBedType } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  systemType: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateBedType(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
