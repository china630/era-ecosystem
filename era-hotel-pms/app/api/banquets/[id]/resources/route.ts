import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  addEventResourceBooking,
  deleteEventResourceBooking,
} from '@/lib/services/event-order.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const createSchema = z.object({
  saloonId: z.string().uuid().optional(),
  posResourceId: z.string().uuid().optional(),
  label: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  notes: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    return jsonOk(
      serialize(await addEventResourceBooking({ ...body, banquetEventId: id })),
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const url = new URL(req.url);
    const bookingId = url.searchParams.get('bookingId');
    if (!bookingId) throw new Error('bookingId query param required');
    await deleteEventResourceBooking(bookingId);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
