import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyVisitOutcome, applySheetOutcome, clearSheetOutcome } from '@/lib/services/hk-nafta.service';

const schema = z.object({
  taskId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  date: z.string().optional(),
  outcome: z.enum(['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO']).optional(),
  clear: z.boolean().optional(),
});

function assertSheetDay(date: string) {
  if (date !== todayBakuYmd()) {
    throw new Error('Cannot edit a floor sheet that is not the business date');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    if (body.roomId) {
      const date = body.date ?? todayBakuYmd();
      assertSheetDay(date);
      if (body.clear || !body.outcome) {
        return jsonOk(serialize(await clearSheetOutcome(body.roomId, date)));
      }
      return jsonOk(serialize(await applySheetOutcome(body.roomId, date, body.outcome, { userId: session?.sub, request })));
    }
    if (!body.taskId || !body.outcome) throw new Error('taskId or roomId required');
    return jsonOk(serialize(await applyVisitOutcome(body.taskId, body.outcome, { userId: session?.sub, request })));
  } catch (err) {
    return handleRouteError(err);
  }
}
