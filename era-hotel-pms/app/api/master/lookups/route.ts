import { z } from 'zod';
import { HotelLookupKind } from '@prisma/client';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createHotelLookup, listHotelLookups } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const kindSchema = z.nativeEnum(HotelLookupKind);

const createSchema = z.object({
  kind: kindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    const url = new URL(request.url);
    const kindRaw = url.searchParams.get('kind');
    const activeOnly = url.searchParams.get('activeOnly') === '1';
    const kind = kindRaw ? kindSchema.parse(kindRaw) : undefined;
    return jsonOk(serialize(await listHotelLookups(kind, activeOnly)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = createSchema.parse(await request.json());
    return jsonOk(serialize(await createHotelLookup(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
