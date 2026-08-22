import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyVisitOutcome } from '@/lib/services/hk-nafta.service';

const schema = z.object({
  taskId: z.string().uuid(),
  outcome: z.enum(['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO']),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await applyVisitOutcome(body.taskId, body.outcome)));
  } catch (err) {
    return handleRouteError(err);
  }
}
