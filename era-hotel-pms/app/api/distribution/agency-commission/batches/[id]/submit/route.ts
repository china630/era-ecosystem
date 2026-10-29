import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { submitCommissionBatch } from '@/lib/services/agency-commission.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    return jsonOk(await submitCommissionBatch(id));
  } catch (err) {
    return handleRouteError(err);
  }
}
