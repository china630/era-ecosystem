import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { patchBarRate } from '@/lib/services/bar-rates.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({ amount: z.number().positive() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await patchBarRate(id, body.amount)));
  } catch (err) {
    return handleRouteError(err);
  }
}
