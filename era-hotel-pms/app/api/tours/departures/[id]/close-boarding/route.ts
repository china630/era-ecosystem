import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { closeTourBoarding } from '@/lib/services/tour.service';

const bodySchema = z.object({
  boardedBookingIds: z.array(z.string().uuid()),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    return jsonOk(serialize(await closeTourBoarding(id, body.boardedBookingIds)));
  } catch (e) {
    return handleRouteError(e);
  }
}
