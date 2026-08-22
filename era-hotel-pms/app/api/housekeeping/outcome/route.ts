import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyVisitOutcome, applySheetOutcome } from '@/lib/services/hk-nafta.service';

const schema = z.object({
  taskId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  date: z.string().optional(),
  outcome: z.enum(['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO']),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    if (body.roomId) {
      const date = body.date ?? new Date().toISOString().slice(0, 10);
      return jsonOk(serialize(await applySheetOutcome(body.roomId, date, body.outcome)));
    }
    if (!body.taskId) throw new Error('taskId or roomId required');
    return jsonOk(serialize(await applyVisitOutcome(body.taskId, body.outcome)));
  } catch (err) {
    return handleRouteError(err);
  }
}
