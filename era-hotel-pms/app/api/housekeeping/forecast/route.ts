import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hkLoadForecast } from '@/lib/services/hk-nafta.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const sp = new URL(request.url).searchParams;
    const days = Number(sp.get('days') ?? '7');
    const from = sp.get('from') ?? new Date().toISOString().slice(0, 10);
    return jsonOk(serialize(await hkLoadForecast(from, days)));
  } catch (err) {
    return handleRouteError(err);
  }
}
