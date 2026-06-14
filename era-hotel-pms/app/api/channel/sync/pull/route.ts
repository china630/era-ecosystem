import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { pullOtaReservations } from '@/lib/channel/ota-pull.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution');

    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    return jsonOk(serialize(await pullOtaReservations(since)));
  } catch (err) {
    return handleRouteError(err);
  }
}
