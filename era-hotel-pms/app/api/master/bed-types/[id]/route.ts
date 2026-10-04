import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateBedType } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  systemType: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateBedType(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
