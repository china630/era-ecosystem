import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { splitStayFromDate } from '@/lib/services/stay-slice.service';
import { getReservationFull } from '@/lib/services/reservation-full.service';
import { serialize } from '@/lib/serialize';

const schema = z.object({
  fromDate: z.string().min(8),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    await splitStayFromDate({
      reservationId: id,
      fromDate: new Date(`${body.fromDate.slice(0, 10)}T12:00:00.000Z`),
      roomTypeId: body.roomTypeId,
      roomId: body.roomId ?? null,
    });
    return jsonOk(serialize(await getReservationFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
