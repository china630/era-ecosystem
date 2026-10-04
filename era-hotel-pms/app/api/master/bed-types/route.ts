import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createBedType, listBedTypes } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  systemType: z.string().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listBedTypes()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createBedType(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
