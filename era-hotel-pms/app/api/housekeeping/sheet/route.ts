import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { generateFloorSheet } from '@/lib/services/hk-nafta.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const sp = new URL(request.url).searchParams;
    const date = sp.get('date') ?? new Date().toISOString().slice(0, 10);
    const floor = Number(sp.get('floor') ?? '2');
    return jsonOk(serialize(await generateFloorSheet(date, floor)));
  } catch (err) {
    return handleRouteError(err);
  }
}
