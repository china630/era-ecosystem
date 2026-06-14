import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { pushChannelAvailability } from '@/lib/channel/ota-push.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution');

    const body = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(await request.json().catch(() => ({})));

    const from = new Date(body.from ?? new Date().toISOString().slice(0, 10));
    const to = new Date(body.to ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

    return jsonOk(serialize(await pushChannelAvailability(from, to)));
  } catch (err) {
    return handleRouteError(err);
  }
}
