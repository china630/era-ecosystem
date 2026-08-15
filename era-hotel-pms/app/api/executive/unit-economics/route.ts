import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getUnitEconomicsSnapshot } from '@/lib/services/unit-economics.service';

export async function GET() {
  try {
    assertAnyPermission(await getSessionFromHeaders(), [
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    return jsonOk(await getUnitEconomicsSnapshot());
  } catch (err) {
    return handleRouteError(err);
  }
}
