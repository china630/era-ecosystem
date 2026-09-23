import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getReconciliationReport } from '@/lib/services/reconciliation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const date =
      new URL(request.url).searchParams.get('businessDate') ?? todayBakuYmd();
    return jsonOk(serialize(await getReconciliationReport(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
