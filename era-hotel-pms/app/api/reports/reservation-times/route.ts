import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationTimes } from '@/lib/services/reports.service';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const from = new Date(url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10));
    const to = new Date(url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10));
    const guestQ = url.searchParams.get('guest') ?? undefined;
    const agencyQ = url.searchParams.get('agency') ?? undefined;
    return jsonOk(serialize(await listReservationTimes({ from, to, guestQ, agencyQ })));
  } catch (err) {
    return handleRouteError(err);
  }
}
