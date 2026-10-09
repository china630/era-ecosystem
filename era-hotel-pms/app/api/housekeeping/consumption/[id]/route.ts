import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteHkConsumption } from '@/lib/services/hk-consumption.service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const { id } = await params;
    await deleteHkConsumption(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
