import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getChannelAvailability } from '@/lib/services/channel.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!fromStr || !toStr) throw new Error('from and to query params required');
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const data = await getChannelAvailability(from, to);
    return jsonOk(serialize(data));
  } catch (err) {
    return handleRouteError(err);
  }
}
