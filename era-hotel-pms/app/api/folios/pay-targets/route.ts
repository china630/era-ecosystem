import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCashierPayTargets } from '@/lib/services/cashier-pay-targets.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const q = new URL(request.url).searchParams.get('q') ?? '';
    return jsonOk(await listCashierPayTargets(q));
  } catch (err) {
    return handleRouteError(err);
  }
}
