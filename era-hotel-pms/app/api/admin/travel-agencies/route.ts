import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listTravelAgencies, upsertTravelAgency } from '@/lib/services/wave-b-master.service';

const schema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  voen: z.string().optional(),
  commissionPercent: z.number().optional(),
  settlementMode: z.enum(['PREPAID', 'POSTPAID']).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    return jsonOk(serialize(await listTravelAgencies()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await upsertTravelAgency(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
