import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getTourDeparture } from '@/lib/services/tour.service';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = await ctx.params;
    return jsonOk(serialize(await getTourDeparture(id)));
  } catch (e) {
    return handleRouteError(e);
  }
}
