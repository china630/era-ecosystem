import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { setNeededByAt } from '@/lib/services/hk-nafta.service';

const schema = z.object({
  roomId: z.string().uuid(),
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(await request.json());
    if (body.date !== todayBakuYmd()) {
      throw new Error('Cannot edit a floor sheet that is not the business date');
    }
    return jsonOk(serialize(await setNeededByAt(body.roomId, body.date, body.time)));
  } catch (err) {
    return handleRouteError(err);
  }
}
