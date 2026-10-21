import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateDepartment } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  name: z.string().min(1).optional(),
  cashPoint: z.enum(['HOTEL', 'FNB_POS', 'CLINIC', 'RETAIL']).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateDepartment(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
