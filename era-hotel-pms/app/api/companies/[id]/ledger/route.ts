import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getCompanyLedger } from '@/lib/services/agency-ledger.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const { id } = await params;
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
    const toStr = url.searchParams.get('to') ?? fromStr;
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    return jsonOk(serialize(await getCompanyLedger(id, from, to)));
  } catch (err) {
    return handleRouteError(err);
  }
}
