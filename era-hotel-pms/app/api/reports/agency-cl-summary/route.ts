import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listAgencyClSummary } from '@/lib/services/agency-ledger.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const params = new URL(request.url).searchParams;
    const from = new Date(params.get('from') ?? new Date().toISOString().slice(0, 10));
    const to = new Date(params.get('to') ?? new Date().toISOString().slice(0, 10));
    to.setHours(23, 59, 59, 999);
    return jsonOk(serialize(await listAgencyClSummary(from, to)));
  } catch (err) {
    return handleRouteError(err);
  }
}
