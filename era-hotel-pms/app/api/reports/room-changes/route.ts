import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createRoomChangePlan, listRoomChangePlans } from '@/lib/services/reports.service';
import { requestRoomMove } from '@/lib/services/room-move-request.service';
import { hotelDateKey } from '@/lib/hotel-calendar';

const createSchema = z.object({
  reservationId: z.string().uuid(),
  fromRoomId: z.string().uuid().optional(),
  toRoomId: z.string().uuid().optional(),
  effectiveAt: z.coerce.date(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    return jsonOk(serialize(await listRoomChangePlans()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    if (body.toRoomId) {
      return jsonOk(
        await requestRoomMove(body.reservationId, body.toRoomId, {
          effectiveDate: hotelDateKey(body.effectiveAt),
          actorUserId: session?.sub,
          request,
        }),
      );
    }
    return jsonOk(
      serialize(await createRoomChangePlan({ ...body, createdByUserId: session?.sub })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
