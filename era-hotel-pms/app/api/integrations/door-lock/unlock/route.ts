import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getDoorLockAdapter } from '@/lib/integrations/door-lock-adapter';
import { getSatelliteSession } from '@/lib/auth/session';

const bodySchema = z.object({
  roomNumber: z.string(),
  reservationId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError('Unauthorized', 401);
    const body = bodySchema.parse(await req.json());
    const result = await getDoorLockAdapter().unlockRoom(body);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
