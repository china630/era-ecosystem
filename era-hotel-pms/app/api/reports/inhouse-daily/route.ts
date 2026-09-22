import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { listInhouseDaily } from '@/lib/services/reports.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const dateStr = new URL(request.url).searchParams.get('date') ?? todayBakuYmd();
    const date = bakuCivilUtcDate(dateStr);
    return jsonOk(serialize(await listInhouseDaily(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
