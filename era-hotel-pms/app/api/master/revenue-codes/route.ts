import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createRevenueCode, listRevenueCodes } from '@/lib/services/master-data.service';
import { scheduleMasterDataSyncDebounced } from '@/lib/integration/master-data-sync-debounce';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  taxTag: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']).optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listRevenueCodes()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    const created = await createRevenueCode(body);
    scheduleMasterDataSyncDebounced();
    return jsonOk(serialize(created), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
