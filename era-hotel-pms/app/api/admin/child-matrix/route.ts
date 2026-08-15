import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createChildPricingRow, listChildPricingMatrix } from '@/lib/services/wave-b-master.service';

const schema = z.object({
  ageFrom: z.number().int().min(0),
  ageTo: z.number().int().min(0),
  discountPercent: z.number().min(0).max(100),
  amountOverride: z.number().min(0).nullable().optional(),
  freeCount: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    return jsonOk(serialize(await listChildPricingMatrix()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createChildPricingRow(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
