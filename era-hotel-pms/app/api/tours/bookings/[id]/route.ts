import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { removeTourBooking } from '@/lib/services/tour.service';

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = await ctx.params;
    let reason: string | undefined;
    try {
      const body = cancelSchema.parse(await req.json());
      reason = body.reason;
    } catch {
      reason = undefined;
    }
    return jsonOk(serialize(await removeTourBooking(id, reason)));
  } catch (e) {
    return handleRouteError(e);
  }
}
