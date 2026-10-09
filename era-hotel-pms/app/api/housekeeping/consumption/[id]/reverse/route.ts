import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { reverseHkConsumption } from '@/lib/services/hk-consumption.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const { id } = await params;
    const saved = await reverseHkConsumption(id);
    return jsonOk(serialize(saved), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
