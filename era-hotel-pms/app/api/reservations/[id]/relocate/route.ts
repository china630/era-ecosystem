import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';

const schema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  compUpgrade: z.boolean().optional(),
  givenRoomTypeId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  effectiveDate: z.string().optional(),
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
    const settlement = body.settlement ?? (body.compUpgrade ? 'HOTEL' : undefined);
    const result = await requestRoomMove(id, body.roomId, {
      effectiveDate: body.effectiveDate,
      reasonCode: body.reasonCode ?? body.reason,
      settlement: isClassSettlement(settlement) ? settlement : null,
      actorUserId: session?.sub,
      request,
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
