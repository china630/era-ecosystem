import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listInhouseDaily } from '@/lib/services/reports.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const dateStr = new URL(request.url).searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : new Date();
    return jsonOk(serialize(await listInhouseDaily(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
