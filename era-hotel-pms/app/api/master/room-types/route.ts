import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createRoomType, listRoomTypes } from '@/lib/services/master-data.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  baseQuota: z.number().int().positive(),
  adultCapacity: z.number().int().optional(),
  standardAdults: z.number().int().min(1).max(10).optional(),
  childCapacity: z.number().int().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listRoomTypes()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createRoomType(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
