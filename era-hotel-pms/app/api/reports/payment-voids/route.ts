import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listVoidedFolioPayments } from '@/lib/services/folio.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    return jsonOk(serialize(await listVoidedFolioPayments()));
  } catch (err) {
    return handleRouteError(err);
  }
}
