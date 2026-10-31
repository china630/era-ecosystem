import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getInventoryCaps, updateHouseOverbook } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  houseOverbookAllowance: z.number().int().nonnegative(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await getInventoryCaps()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertMasterDataWrite(session);
    const body = schema.parse(await request.json());
    await updateHouseOverbook(body.houseOverbookAllowance, { userId: session?.sub });
    return jsonOk(serialize(await getInventoryCaps()));
  } catch (err) {
    return handleRouteError(err);
  }
}
