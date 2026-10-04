import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listCompanies } from '@/lib/services/company.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    return jsonOk(serialize(await listCompanies()));
  } catch (err) {
    return handleRouteError(err);
  }
}
