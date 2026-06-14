import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createBedType, listBedTypes } from '@/lib/services/master-data.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  systemType: z.string().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    return jsonOk(serialize(await listBedTypes()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createBedType(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
