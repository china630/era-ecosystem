import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { dismissDuplicateGroup } from '@/lib/services/guest-dedup.service';

const schema = z.object({
  guestIds: z.array(z.string().min(1)).min(2),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    await dismissDuplicateGroup(body.guestIds);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
