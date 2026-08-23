import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createTourDeparture, listTourDepartures } from '@/lib/services/tour.service';

const bodySchema = z.object({
  templateId: z.string().uuid().optional(),
  date: z.string(),
  pickupAt: z.string().datetime(),
  returnAt: z.string().datetime(),
  agenda: z.string().optional(),
  meetingPoint: z.string().optional(),
  guideName: z.string().optional(),
  vehicleId: z.string().uuid().optional(),
  capacity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status') ?? undefined;
    return jsonOk(
      serialize(
        await listTourDepartures({
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
          status,
        }),
      ),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_transfers');
    const body = bodySchema.parse(await req.json());
    return jsonOk(
      serialize(
        await createTourDeparture({
          ...body,
          date: new Date(body.date),
          pickupAt: new Date(body.pickupAt),
          returnAt: new Date(body.returnAt),
        }),
      ),
      201,
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
