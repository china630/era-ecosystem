import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getTourDeparture, updateTourDeparture } from '@/lib/services/tour.service';
import type { TourDepartureStatus } from '@prisma/client';

const patchSchema = z.object({
  agenda: z.string().optional(),
  meetingPoint: z.string().optional(),
  guideName: z.string().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  pickupAt: z.string().datetime().optional(),
  returnAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'DEPARTED', 'CANCELLED']).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const { id } = await ctx.params;
    return jsonOk(serialize(await getTourDeparture(id)));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    return jsonOk(
      serialize(
        await updateTourDeparture(id, {
          ...body,
          pickupAt: body.pickupAt ? new Date(body.pickupAt) : undefined,
          returnAt: body.returnAt ? new Date(body.returnAt) : undefined,
          status: body.status as TourDepartureStatus | undefined,
        }),
      ),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
