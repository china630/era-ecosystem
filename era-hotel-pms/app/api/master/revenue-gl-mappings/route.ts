import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listRevenueGlMappings,
  upsertRevenueGlMapping,
} from '@/lib/services/revenue-gl-mapping.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const upsertSchema = z.object({
  revenueCodeId: z.string().uuid(),
  glAccountCode: z.string().min(1).max(20),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    return jsonOk(serialize(await listRevenueGlMappings()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = upsertSchema.parse(await request.json());
    const updated = await upsertRevenueGlMapping(body.revenueCodeId, body.glAccountCode);
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
