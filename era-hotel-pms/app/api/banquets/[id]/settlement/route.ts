import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getEventSettlement } from '@/lib/services/event-order.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = await ctx.params;
    return jsonOk(serialize(await getEventSettlement(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
