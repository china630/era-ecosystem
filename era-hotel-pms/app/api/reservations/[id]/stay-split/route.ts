import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { splitStayFromDate } from '@/lib/services/stay-slice.service';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';
import { getReservationFull } from '@/lib/services/reservation-full.service';
import { serialize } from '@/lib/serialize';

const schema = z.object({
  fromDate: z.string().min(8),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  reasonCode: z.string().optional(),
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
    if (body.roomId) {
      const result = await requestRoomMove(id, body.roomId, {
        effectiveDate: body.fromDate.slice(0, 10),
        settlement: isClassSettlement(body.settlement) ? body.settlement : null,
        reasonCode: body.reasonCode,
        actorUserId: session?.sub,
        request,
      });
      return jsonOk(serialize({ ...(await getReservationFull(id)), movePending: result.pending }));
    }
    await splitStayFromDate({
      reservationId: id,
      fromDate: new Date(`${body.fromDate.slice(0, 10)}T12:00:00.000Z`),
      roomTypeId: body.roomTypeId,
      roomId: null,
      actorUserId: session?.sub,
    });
    return jsonOk(serialize(await getReservationFull(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
