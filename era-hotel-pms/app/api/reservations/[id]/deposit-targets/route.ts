import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listDepositTargets } from '@/lib/services/folio-deposit.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listDepositTargets(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
