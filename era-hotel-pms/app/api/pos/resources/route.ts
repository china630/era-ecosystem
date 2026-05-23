/** @deprecated Lite calendar moved to era-fb-pos; kept for backward compatibility. */
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { createPosResource, listPosResources } from '@/lib/services/pos.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  resourceType: z.enum(['TABLE', 'SPA_CABIN']),
  outletCode: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    return jsonOk(serialize(await listPosResources()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createPosResource(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
