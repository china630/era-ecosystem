import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { updateFleetVehicle } from '@/lib/services/fleet.service';

const patchSchema = z.object({
  brand: z.string().optional(),
  licensePlate: z.string().optional(),
  driverName: z.string().nullable().optional(),
  driverPhone: z.string().nullable().optional(),
  maxSeats: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    return jsonOk(serialize(await updateFleetVehicle(id, body)));
  } catch (e) {
    return handleRouteError(e);
  }
}
