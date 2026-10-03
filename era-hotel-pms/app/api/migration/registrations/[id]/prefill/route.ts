import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getMigrationPrefill } from '@/lib/services/migration-registration.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await requireHotelModule('hotel_migration_pro', session.organizationId);
    const { id } = await params;
    return jsonOk(serialize(await getMigrationPrefill(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
