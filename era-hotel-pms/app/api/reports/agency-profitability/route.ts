import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { reportAgencyProfitability } from '@/lib/services/agency-profitability.service';

export async function GET(request: Request) {
  try {
    assertPermission(await getSessionFromHeaders(), PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!fromStr || !toStr) {
      return jsonError('from and to query params required (YYYY-MM-DD)', 400);
    }
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return jsonError('Invalid date range', 400);
    }
    return jsonOk(await reportAgencyProfitability(from, to));
  } catch (err) {
    return handleRouteError(err);
  }
}
