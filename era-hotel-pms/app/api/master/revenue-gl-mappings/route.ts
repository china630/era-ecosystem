import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { REVENUE_CODE_ROLES } from '@/lib/revenue-code-match';
import {
  listRevenueGlMappings,
  setRevenueCodeRole,
  upsertRevenueGlMapping,
} from '@/lib/services/revenue-gl-mapping.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const upsertSchema = z
  .object({
    revenueCodeId: z.string().uuid(),
    glAccountCode: z.string().min(1).max(20).optional(),
    systemRole: z.enum(REVENUE_CODE_ROLES).nullable().optional(),
  })
  .refine((b) => b.glAccountCode !== undefined || b.systemRole !== undefined, {
    message: 'glAccountCode or systemRole is required',
  });

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listRevenueGlMappings()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = upsertSchema.parse(await request.json());
    if (body.systemRole !== undefined) {
      await setRevenueCodeRole(body.revenueCodeId, body.systemRole);
    }
    const updated =
      body.glAccountCode !== undefined
        ? await upsertRevenueGlMapping(body.revenueCodeId, body.glAccountCode)
        : null;
    return jsonOk(serialize(updated ?? { revenueCodeId: body.revenueCodeId }));
  } catch (err) {
    return handleRouteError(err);
  }
}
