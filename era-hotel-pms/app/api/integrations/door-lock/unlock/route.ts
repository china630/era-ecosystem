import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getDoorLockAdapter } from '@/lib/integrations/door-lock-adapter';

const bodySchema = z.object({
  roomNumber: z.string(),
  reservationId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await getDoorLockAdapter().unlockRoom(body);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
